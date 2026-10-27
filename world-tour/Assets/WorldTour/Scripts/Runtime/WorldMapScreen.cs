using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using WorldTour.Core;

namespace WorldTour
{
    /// <summary>Interactive world map: zoom/pan, destination search, info panels and flight booking.</summary>
    public sealed class WorldMapScreen
    {
        const float TopBar = 56;
        const float TapSlop = 12;

        readonly GameManager gm;
        readonly MapViewport vp = new MapViewport();
        readonly UiFlow infoFlow = new UiFlow();
        readonly UiFlow searchFlow = new UiFlow();

        Destination selected;
        Country selectedCountry;
        bool searchOpen;
        string query = "";
        bool confirmOpen;

        bool dragging, pinching, pinchedThisGesture;
        Vector2 lastPointer;
        float dragDistance;
        float lastPinchDistance;

        public WorldMapScreen(GameManager gm) { this.gm = gm; }

        public void FocusCurrent()
        {
            var cur = gm.Travel?.Current;
            if (cur != null) vp.CenterOn(cur.Lat, cur.Lon, 3);
            selected = null;
            selectedCountry = null;
            confirmOpen = false;
        }

        /// <summary>Closes the topmost overlay. Returns false if there was none.</summary>
        public bool HandleBack()
        {
            if (confirmOpen) { confirmOpen = false; return true; }
            if (selected != null || selectedCountry != null) { selected = null; selectedCountry = null; return true; }
            if (searchOpen) { searchOpen = false; return true; }
            return false;
        }

        // Pinch zoom needs multi-touch, which IMGUI events do not expose.
        public void Update()
        {
            if (Input.touchCount == 2 && !confirmOpen)
            {
                var a = Input.GetTouch(0);
                var b = Input.GetTouch(1);
                float dist = Vector2.Distance(a.position, b.position);
                Vector2 mid = (a.position + b.position) / 2;
                var guiMid = new Vector2(mid.x, UnityEngine.Screen.height - mid.y);
                if (!pinching) { pinching = true; pinchedThisGesture = true; dragging = false; lastPinchDistance = dist; }
                else if (lastPinchDistance > 1 && !UiKit.IsBlocked(guiMid))
                {
                    vp.ZoomAt(guiMid.x, guiMid.y, dist / lastPinchDistance);
                    lastPinchDistance = dist;
                }
            }
            else if (Input.touchCount == 0) pinching = false;
        }

        public void Draw()
        {
            var mapRect = UiKit.R(0, TopBar, UiKit.VW, UiKit.VH - TopBar);
            vp.SetScreen(mapRect.x, mapRect.y, mapRect.width, mapRect.height);

            if (Event.current.type == EventType.Repaint)
            {
                // map content has no controls, so it only needs drawing on Repaint
                DrawMap(vp, gm.MapTexture);
                DrawCountryLabels();
                DrawAirportsAndPois();
                DrawDestinationMarkers();
            }

            DrawLegend();
            DrawTopBar();
            if (searchOpen) DrawSearch();
            if (selected != null) DrawDestinationPanel();
            else if (selectedCountry != null) DrawCountryPanel();
            if (confirmOpen && selected != null) DrawConfirm();

            HandleMapInput(mapRect);
        }

        // ---------------- map rendering ----------------

        public static void DrawMap(MapViewport vp, Texture2D tex)
        {
            vp.VisibleRect(out double u, out double v, out double uw, out double vh);
            var screen = new Rect((float)vp.ScreenX, (float)vp.ScreenY, (float)vp.ScreenW, (float)vp.ScreenH);
            // texture rows are bottom-up, map coords are top-down
            GUI.DrawTextureWithTexCoords(screen, tex, new Rect((float)u, (float)(1 - v - vh), (float)uw, (float)vh));
        }

        Vector2 ToScreen(double lat, double lon)
        {
            vp.LatLonToScreen(lat, lon, out double x, out double y);
            return new Vector2((float)x, (float)y);
        }

        bool OnMap(Vector2 p) => p.x >= vp.ScreenX && p.x <= vp.ScreenX + vp.ScreenW && p.y >= vp.ScreenY && p.y <= vp.ScreenY + vp.ScreenH;

        void DrawCountryLabels()
        {
            var style = UiKit.MapLabel;
            foreach (var c in gm.Db.Countries)
            {
                var a = ToScreen(c.MaxLat, c.MinLon);
                var b = ToScreen(c.MinLat, c.MaxLon);
                float widthPx = b.x - a.x;
                var size = style.CalcSize(new GUIContent(c.Name));
                if (widthPx < size.x * 1.2f) continue;
                var p = ToScreen(c.LabelLat, c.LabelLon);
                if (!OnMap(p)) continue;
                UiKit.ShadowLabel(new Rect(p.x - size.x / 2, p.y - size.y / 2, size.x, size.y), c.Name, style, new Color(1, 1, 1, 0.85f));
            }
        }

        void DrawAirportsAndPois()
        {
            float s = UiKit.S;
            if (vp.Zoom >= 4)
            {
                foreach (var a in gm.Db.Airports)
                {
                    var p = ToScreen(a.Lat, a.Lon);
                    if (!OnMap(p)) continue;
                    UiKit.Fill(new Rect(p.x - 4 * s, p.y - 4 * s, 8 * s, 8 * s), new Color(0.3f, 0.75f, 1f));
                    UiKit.ShadowLabel(new Rect(p.x + 6 * s, p.y - 9 * s, 60 * s, 18 * s), a.Code, UiKit.Tag, new Color(0.6f, 0.85f, 1f));
                }
            }
            if (vp.Zoom >= 7)
            {
                foreach (var d in gm.Db.Destinations)
                    foreach (var poi in d.Pois)
                    {
                        var p = ToScreen(poi.Lat, poi.Lon);
                        if (!OnMap(p)) continue;
                        UiKit.DrawCircle(p, 4 * s, PoiColor(poi.Kind));
                        UiKit.ShadowLabel(new Rect(p.x + 6 * s, p.y - 8 * s, 220 * s, 16 * s), poi.Name, UiKit.Small, new Color(1, 1, 0.9f));
                    }
            }
        }

        static Color PoiColor(string kind)
        {
            switch (kind)
            {
                case "mountain": return new Color(0.85f, 0.85f, 0.95f);
                case "lake": return new Color(0.4f, 0.75f, 1f);
                case "coast": return new Color(0.4f, 0.95f, 0.95f);
                default: return new Color(1f, 0.6f, 0.85f);
            }
        }

        public Color MarkerColor(Destination d)
        {
            if (gm.Profile != null && d.Id == gm.Profile.CurrentDestinationId) return UiKit.Gold;
            return d.IsExplorable ? UiKit.Green : UiKit.Grey;
        }

        void DrawDestinationMarkers()
        {
            float s = UiKit.S;
            foreach (var d in gm.Db.Destinations)
            {
                var p = ToScreen(d.Lat, d.Lon);
                if (!OnMap(p)) continue;
                bool sel = d == selected;
                if (sel) UiKit.DrawCircle(p, 15 * s, Color.white);
                UiKit.DrawCircle(p, (sel ? 11 : 8) * s, MarkerColor(d));
                bool visited = gm.Profile != null && gm.Profile.VisitedDestinations.Contains(d.Id);
                string label = visited ? d.Name + " *" : d.Name;
                UiKit.ShadowLabel(new Rect(p.x + 10 * s, p.y - 10 * s, 220 * s, 20 * s), label, UiKit.Tag, Color.white);
            }
        }

        void DrawLegend()
        {
            var r = UiKit.R(10, UiKit.VH - 110, 300, 100);
            UiKit.DrawPanel(r);
            float s = UiKit.S;
            void Row(int i, Color c, string text)
            {
                var y = r.y + (12 + i * 22) * s;
                UiKit.DrawCircle(new Vector2(r.x + 18 * s, y + 8 * s), 6 * s, c);
                GUI.Label(new Rect(r.x + 32 * s, y - 2 * s, r.width - 36 * s, 22 * s), text, UiKit.Small);
            }
            Row(0, UiKit.Gold, "You are here");
            Row(1, UiKit.Green, "Explorable 3D destination");
            Row(2, UiKit.Grey, "Map preview only (3D not built yet)");
            GUI.Label(new Rect(r.x + 12 * s, r.y + 76 * s, r.width, 20 * s), "* visited   Zoom in for airports & sights", UiKit.Small);
        }

        void DrawTopBar()
        {
            var bar = UiKit.R(0, 0, UiKit.VW, TopBar);
            UiKit.DrawPanel(bar);
            var cur = gm.Travel.Current;
            GUI.Label(UiKit.R(12, 6, 360, 26), "WORLD MAP", UiKit.Heading);
            GUI.Label(UiKit.R(12, 32, 420, 22), $"Location: {cur.Name}, {gm.Db.CountryName(cur.CountryId)}", UiKit.Small);

            float x = UiKit.VW - 8;
            float Next(float w) { x -= w + 6; return x; }
            if (UiKit.Btn(UiKit.R(Next(80), 8, 80, 40), "Menu")) gm.Show(GameScreen.Pause);
            if (UiKit.Btn(UiKit.R(Next(90), 8, 90, 40), "Profile")) gm.Show(GameScreen.Profile);
            if (UiKit.Btn(UiKit.R(Next(90), 8, 90, 40), searchOpen ? "Close" : "Search")) searchOpen = !searchOpen;
            if (UiKit.Btn(UiKit.R(Next(44), 8, 44, 40), "-")) ZoomCenter(1 / 1.5);
            if (UiKit.Btn(UiKit.R(Next(44), 8, 44, 40), "+")) ZoomCenter(1.5);
            if (gm.City != null && UiKit.Btn(UiKit.R(Next(150), 8, 150, 40), "Back to " + gm.City.Destination.Name)) gm.Show(GameScreen.Explore);
            var coinRect = UiKit.R(Next(150), 8, 150, 40);
            UiKit.ShadowLabel(coinRect, UiKit.Coins(gm.Profile.Coins), UiKit.RightHeading, UiKit.Gold);
        }

        void ZoomCenter(double factor) => vp.ZoomAt(vp.ScreenX + vp.ScreenW / 2, vp.ScreenY + vp.ScreenH / 2, factor);

        void DrawSearch()
        {
            var r = UiKit.R(10, TopBar + 10, 330, Mathf.Min(460, UiKit.VH - TopBar - 140));
            UiKit.DrawPanel(r);
            float s = UiKit.S;
            GUI.SetNextControlName("wt_search");
            query = GUI.TextField(new Rect(r.x + 10 * s, r.y + 10 * s, r.width - 20 * s, 40 * s), query, 40, UiKit.TextField);
            var results = gm.Db.Search(query, 30);
            searchFlow.Begin(new Rect(r.x, r.y + 56 * s, r.width, r.height - 56 * s));
            if (results.Count == 0) searchFlow.Label("No matching destinations.", UiKit.Small);
            foreach (var d in results)
            {
                string tag = d.IsExplorable ? "3D" : "map";
                if (searchFlow.Button($"{d.Name}, {gm.Db.CountryName(d.CountryId)}  [{d.AirportCode} · {tag}]", true, 40))
                    Select(d, true);
            }
            searchFlow.End();
        }

        void Select(Destination d, bool center)
        {
            selected = d;
            selectedCountry = null;
            confirmOpen = false;
            infoFlow.ResetScroll();
            GUI.FocusControl(null);
            if (center) vp.CenterOn(d.Lat, d.Lon, Mathf.Max((float)vp.Zoom, 4f));
        }

        Rect InfoPanelRect() => UiKit.R(UiKit.VW - 390, TopBar + 10, 380, UiKit.VH - TopBar - 20);

        void DrawDestinationPanel()
        {
            var d = selected;
            var db = gm.Db;
            var airport = db.GetAirport(d.AirportCode);
            infoFlow.Begin(InfoPanelRect());
            infoFlow.Label(d.Name, UiKit.Heading);
            infoFlow.Label($"{Capitalise(d.Kind)} · {db.CountryName(d.CountryId)}", UiKit.Small);
            if (d.IsExplorable) infoFlow.ColorLabel("Explorable 3D area available", UiKit.Tag, UiKit.Green);
            else infoFlow.ColorLabel("Map preview only - 3D area not built yet", UiKit.Tag, UiKit.Grey);
            infoFlow.Space(4);
            infoFlow.Label(d.Description, UiKit.Label);
            infoFlow.Label($"<b>Airport:</b> {airport.Name} ({airport.Code})", UiKit.Small);
            if (d.Pois.Count > 0) infoFlow.Label("<b>Highlights:</b> " + string.Join(", ", d.Pois.Select(p => p.Name)), UiKit.Small);
            infoFlow.Space(8);

            if (d.Id == gm.Profile.CurrentDestinationId)
            {
                infoFlow.ColorLabel("You are here.", UiKit.Label, UiKit.Gold);
                if (d.IsExplorable && infoFlow.Button(gm.City != null ? "Return to the streets" : "Explore " + d.Name))
                    gm.EnterCity(d);
            }
            else
            {
                var q = gm.Travel.Quote(d.Id);
                infoFlow.Label("<b>FLIGHT</b>", UiKit.Label);
                infoFlow.Label($"{q.FromAirport.Code} ({q.From.Name}) -> {q.ToAirport.Code} ({q.To.Name})", UiKit.Small);
                infoFlow.Label($"Distance: {q.DistanceKm:N0} km  ·  {(q.International ? "International" : "Domestic")}", UiKit.Small);
                infoFlow.Label($"Fare: <b>{UiKit.Coins(q.Price)}</b>   Balance: {UiKit.Coins(gm.Profile.Coins)}", UiKit.Label);
                infoFlow.Label("(Fictional game-economy fare, not a real airline price.)", UiKit.Small);
                if (!q.Available)
                {
                    infoFlow.ColorLabel(q.UnavailableReason, UiKit.Small, UiKit.Grey);
                }
                else if (q.Shortfall > 0)
                {
                    infoFlow.ColorLabel($"You need {UiKit.Coins(q.Shortfall)} more.", UiKit.Label, UiKit.Red);
                    infoFlow.Label("Ways to earn coins:", UiKit.Small);
                    foreach (var tip in gm.Travel.EarningSuggestions()) infoFlow.Label("- " + tip, UiKit.Small);
                }
                if (infoFlow.Button($"Book flight - {UiKit.Coins(q.Price)}", q.CanBook)) confirmOpen = true;
            }
            infoFlow.Space(6);
            if (infoFlow.Button("Close", true, 38)) selected = null;
            infoFlow.End();
        }

        void DrawCountryPanel()
        {
            var c = selectedCountry;
            infoFlow.Begin(InfoPanelRect());
            infoFlow.Label(c.Name, UiKit.Heading);
            infoFlow.Label(c.Continent, UiKit.Small);
            var dests = gm.Db.DestinationsIn(c.Id).ToList();
            if (dests.Count == 0)
            {
                infoFlow.ColorLabel("No destinations here yet. This country is shown on the map but has not been developed.", UiKit.Label, UiKit.Grey);
            }
            else
            {
                infoFlow.Label("Destinations:", UiKit.Label);
                foreach (var d in dests)
                    if (infoFlow.Button($"{d.Name}  ({(d.IsExplorable ? "3D" : "map only")})", true, 40)) Select(d, true);
            }
            infoFlow.Space(6);
            if (infoFlow.Button("Close", true, 38)) selectedCountry = null;
            infoFlow.End();
        }

        void DrawConfirm()
        {
            var full = new Rect(0, 0, UnityEngine.Screen.width, UnityEngine.Screen.height);
            UiKit.Block(full);
            UiKit.Fill(full, new Color(0, 0, 0, 0.6f));
            var q = gm.Travel.Quote(selected.Id);
            var r = UiKit.R(UiKit.VW / 2 - 230, UiKit.VH / 2 - 150, 460, 300);
            UiKit.DrawPanel(r);
            float s = UiKit.S;
            GUI.Label(new Rect(r.x + 20 * s, r.y + 16 * s, r.width - 40 * s, 30 * s), "Confirm booking", UiKit.Heading);
            string body =
                $"{q.FromAirport.Name} ({q.FromAirport.Code})\n  to {q.ToAirport.Name} ({q.ToAirport.Code})\n\n" +
                $"Distance: {q.DistanceKm:N0} km\nFare: <b>{UiKit.Coins(q.Price)}</b>\n" +
                $"Balance after: {UiKit.Coins(gm.Profile.Coins)} -> <b>{UiKit.Coins(gm.Profile.Coins - q.Price)}</b>";
            GUI.Label(new Rect(r.x + 20 * s, r.y + 54 * s, r.width - 40 * s, 170 * s), body, UiKit.Label);
            if (GUI.Button(new Rect(r.x + 20 * s, r.yMax - 64 * s, 200 * s, 48 * s), "Pay & board", UiKit.Button))
            {
                confirmOpen = false;
                var id = selected.Id;
                selected = null;
                gm.BookFlight(id);
            }
            if (GUI.Button(new Rect(r.xMax - 160 * s, r.yMax - 64 * s, 140 * s, 48 * s), "Cancel", UiKit.Button)) confirmOpen = false;
        }

        // ---------------- input ----------------

        void HandleMapInput(Rect mapRect)
        {
            var e = Event.current;
            if (confirmOpen) return;
            switch (e.type)
            {
                case EventType.MouseDown:
                    if (e.button == 0 && mapRect.Contains(e.mousePosition) && !UiKit.IsBlocked(e.mousePosition))
                    {
                        dragging = true;
                        pinchedThisGesture = false;
                        dragDistance = 0;
                        lastPointer = e.mousePosition;
                        GUI.FocusControl(null);
                        e.Use();
                    }
                    break;
                case EventType.MouseDrag:
                    if (dragging && !pinching)
                    {
                        var delta = e.mousePosition - lastPointer;
                        lastPointer = e.mousePosition;
                        dragDistance += delta.magnitude;
                        vp.Pan(delta.x, delta.y);
                        e.Use();
                    }
                    break;
                case EventType.MouseUp:
                    if (dragging)
                    {
                        dragging = false;
                        if (dragDistance < TapSlop * UiKit.S && !pinchedThisGesture) Tap(e.mousePosition);
                        e.Use();
                    }
                    break;
                case EventType.ScrollWheel:
                    if (mapRect.Contains(e.mousePosition) && !UiKit.IsBlocked(e.mousePosition))
                    {
                        vp.ZoomAt(e.mousePosition.x, e.mousePosition.y, e.delta.y < 0 ? 1.25 : 1 / 1.25);
                        e.Use();
                    }
                    break;
            }
        }

        void Tap(Vector2 pos)
        {
            Destination best = null;
            float bestDist = 26 * UiKit.S;
            foreach (var d in gm.Db.Destinations)
            {
                float dist = Vector2.Distance(ToScreen(d.Lat, d.Lon), pos);
                if (dist < bestDist) { bestDist = dist; best = d; }
            }
            if (best != null) { Select(best, false); return; }

            vp.ScreenToWorld(pos.x, pos.y, out double u, out double v);
            GeoMath.Unproject(u, v, out double lat, out double lon);
            selectedCountry = gm.Db.CountryAt(lat, lon);
            selected = null;
            infoFlow.ResetScroll();
        }

        static string Capitalise(string s) => string.IsNullOrEmpty(s) ? s : char.ToUpper(s[0]) + s.Substring(1);
    }
}
