using UnityEngine;

namespace WorldTour
{
    /// <summary>On-foot HUD: coins, sightseeing objectives, navigation hint, landmark interaction and joystick.</summary>
    public sealed class ExploreHud
    {
        readonly GameManager gm;
        LandmarkInfo nearby;
        float helpUntil;

        public ExploreHud(GameManager gm) { this.gm = gm; }

        public void Reset()
        {
            nearby = null;
            helpUntil = Time.unscaledTime + 12f;
            TouchControls.Clear();
        }

        public void Update()
        {
            TouchControls.UpdateInput();
            var city = gm.City;
            if (city == null || gm.Player == null) return;
            var pos = gm.Player.transform.position;
            nearby = null;
            float best = float.MaxValue;
            foreach (var l in city.Landmarks)
            {
                float d = FlatDistance(pos, l.Position);
                if (d < l.InteractRadius && d < best) { best = d; nearby = l; }
            }
            if (nearby != null && Input.GetKeyDown(KeyCode.E) && !Visited(nearby)) gm.VisitLandmark(nearby);
        }

        bool Visited(LandmarkInfo l) => gm.Profile.VisitedLandmarks.Contains(l.Spec.Id);

        static float FlatDistance(Vector3 a, Vector3 b) => new Vector2(a.x - b.x, a.z - b.z).magnitude;

        public void Draw()
        {
            var city = gm.City;
            if (city == null) return;
            // top bar
            var bar = UiKit.R(0, 0, UiKit.VW, 56);
            UiKit.DrawPanel(bar);
            var d = city.Destination;
            GUI.Label(UiKit.R(12, 6, 420, 28), d.Name.ToUpper(), UiKit.Heading);
            GUI.Label(UiKit.R(12, 32, 420, 22), gm.Db.CountryName(d.CountryId) + " · exploring on foot", UiKit.Small);
            if (UiKit.Btn(UiKit.R(UiKit.VW - 88, 8, 80, 40), "Menu")) gm.Show(GameScreen.Pause);
            if (UiKit.Btn(UiKit.R(UiKit.VW - 218, 8, 124, 40), "World map")) gm.OpenMap();
            UiKit.ShadowLabel(UiKit.R(UiKit.VW - 380, 8, 150, 40), UiKit.Coins(gm.Profile.Coins), UiKit.RightHeading, UiKit.Gold);

            DrawObjectives(city);
            DrawNavigation(city);
            if (nearby != null) DrawInteraction(nearby);
            DrawJoystick();

            if (Time.unscaledTime < helpUntil)
            {
                var r = UiKit.R(UiKit.VW / 2 - 300, 66, 600, 50);
                UiKit.Fill(r, new Color(0, 0, 0, 0.55f));
                GUI.Label(r, "Move: joystick or WASD · Run: push stick fully or Shift\nLook: drag the screen or mouse · Zoom: mouse wheel · Visit: button or E", UiKit.CenterSmall);
            }
        }

        void DrawObjectives(CityEnvironment city)
        {
            int done = 0;
            foreach (var l in city.Landmarks) if (Visited(l)) done++;
            float h = 44 + city.Landmarks.Count * 24;
            var r = UiKit.R(10, 66, 290, h);
            UiKit.DrawPanel(r);
            float s = UiKit.S;
            GUI.Label(new Rect(r.x + 12 * s, r.y + 8 * s, r.width, 26 * s), $"Sightseeing  {done}/{city.Landmarks.Count}", UiKit.Label);
            for (int i = 0; i < city.Landmarks.Count; i++)
            {
                var l = city.Landmarks[i];
                bool v = Visited(l);
                string text = (v ? "[x] " : "[  ] ") + l.Spec.Name + (v ? "" : $"  +{gm.Db.Economy.LandmarkReward}");
                var old = UiKit.Small.normal.textColor;
                UiKit.Small.normal.textColor = v ? UiKit.Green : old;
                GUI.Label(new Rect(r.x + 14 * s, r.y + (36 + i * 24) * s, r.width - 20 * s, 24 * s), text, UiKit.Small);
                UiKit.Small.normal.textColor = old;
            }
        }

        void DrawNavigation(CityEnvironment city)
        {
            var player = gm.Player.transform.position;
            LandmarkInfo target = null;
            float best = float.MaxValue;
            foreach (var l in city.Landmarks)
            {
                if (Visited(l)) continue;
                float dist = FlatDistance(player, l.Position);
                if (dist < best) { best = dist; target = l; }
            }
            string text;
            if (target == null) text = "All sights here visited! Open the world map to plan your next trip.";
            else if (target == nearby) text = $"You are at {target.Spec.Name}.";
            else text = $"Next sight: {target.Spec.Name} · {best:0} m {Compass(target.Position - player)}";
            var r = UiKit.R(UiKit.VW / 2 - 260, UiKit.VH - 46, 520, 36);
            UiKit.Fill(r, new Color(0, 0, 0, 0.5f));
            GUI.Label(r, text, UiKit.CenterLabel);

            // arrow relative to the camera so "up" means straight ahead
            if (target != null && target != nearby && gm.MainCamera != null)
            {
                var dir = target.Position - player;
                float camYaw = gm.MainCamera.transform.eulerAngles.y;
                float angle = Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg - camYaw;
                var c = new Vector2(r.x - 26 * UiKit.S, r.center.y);
                var m = GUI.matrix;
                GUIUtility.RotateAroundPivot(angle, c);
                UiKit.Fill(new Rect(c.x - 3 * UiKit.S, c.y - 14 * UiKit.S, 6 * UiKit.S, 22 * UiKit.S), UiKit.Gold);
                UiKit.Fill(new Rect(c.x - 9 * UiKit.S, c.y - 14 * UiKit.S, 18 * UiKit.S, 5 * UiKit.S), UiKit.Gold);
                GUI.matrix = m;
            }
        }

        static string Compass(Vector3 dir)
        {
            string[] names = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" };
            float deg = (Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg + 360f + 22.5f) % 360f;
            return names[(int)(deg / 45f) % 8];
        }

        void DrawInteraction(LandmarkInfo l)
        {
            var r = UiKit.R(UiKit.VW - 410, UiKit.VH - 260, 400, 200);
            UiKit.DrawPanel(r);
            float s = UiKit.S;
            GUI.Label(new Rect(r.x + 14 * s, r.y + 10 * s, r.width - 28 * s, 30 * s), l.Spec.Name, UiKit.Heading);
            GUI.Label(new Rect(r.x + 14 * s, r.y + 42 * s, r.width - 28 * s, 90 * s), l.Spec.Description, UiKit.Small);
            var btn = new Rect(r.x + 14 * s, r.yMax - 58 * s, r.width - 28 * s, 46 * s);
            if (Visited(l))
            {
                UiKit.Fill(btn, new Color(0.2f, 0.4f, 0.25f, 0.6f));
                GUI.Label(btn, "Visited", UiKit.CenterLabel);
            }
            else if (UiKit.Btn(btn, $"Visit & take photo  (+{gm.Db.Economy.LandmarkReward} coins)")) gm.VisitLandmark(l);
        }

        void DrawJoystick()
        {
            var c = TouchControls.StickCenter;
            float r = TouchControls.StickRadius;
            UiKit.DrawCircle(c, r, new Color(1, 1, 1, TouchControls.StickActive ? 0.28f : 0.15f));
            var knob = TouchControls.StickActive ? TouchControls.StickKnob : c;
            UiKit.DrawCircle(knob, r * 0.42f, new Color(1, 1, 1, 0.55f));
        }
    }
}
