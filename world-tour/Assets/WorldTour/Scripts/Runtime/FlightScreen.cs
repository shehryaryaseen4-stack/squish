using UnityEngine;
using WorldTour.Core;

namespace WorldTour
{
    /// <summary>
    /// Prototype flight: boarding, takeoff, cruise and landing shown as a plane
    /// moving along the great-circle route on the map. Airport and cabin
    /// interiors come in a later phase.
    /// </summary>
    public sealed class FlightScreen
    {
        static readonly (float end, string title, string text)[] Phases =
        {
            (0.16f, "Boarding", "Passengers are boarding. Please have your ticket ready."),
            (0.30f, "Takeoff", "Cabin crew, prepare for departure."),
            (0.82f, "Cruising", "Sit back and enjoy the flight."),
            (1.00f, "Descent & landing", "We have started our descent. Fasten your seat belt."),
        };

        readonly GameManager gm;
        readonly MapViewport vp = new MapViewport();
        Ticket ticket;
        Airport from, to;
        float elapsed, duration;
        bool landed;

        public FlightScreen(GameManager gm) { this.gm = gm; }

        public void Begin(Ticket t)
        {
            ticket = t;
            from = gm.Db.GetAirport(t.FromAirport);
            to = gm.Db.GetAirport(t.ToAirport);
            elapsed = 0;
            landed = false;
            duration = Mathf.Clamp(8f + (float)t.DistanceKm / 900f, 9f, 18f);
        }

        public void Update()
        {
            if (ticket == null || landed) return;
            elapsed += Time.unscaledDeltaTime;
            if (elapsed >= duration) Land();
        }

        void Land()
        {
            landed = true;
            gm.LandFlight();
        }

        float Progress => Mathf.Clamp01(elapsed / duration);

        /// <summary>0..1 position of the plane along the route.</summary>
        float RouteFraction
        {
            get
            {
                float p = Progress;
                float start = Phases[0].end, end = 0.97f;
                return Mathf.SmoothStep(0, 1, Mathf.InverseLerp(start, end, p));
            }
        }

        public void Draw()
        {
            if (ticket == null) return;
            float s = UiKit.S;
            var mapRect = UiKit.R(0, 0, UiKit.VW, UiKit.VH);
            vp.SetScreen(mapRect.x, mapRect.y, mapRect.width, mapRect.height);
            FitRoute();
            WorldMapScreen.DrawMap(vp, gm.MapTexture);

            // route
            const int dots = 48;
            for (int i = 0; i <= dots; i++)
            {
                GeoMath.Interpolate(from.Lat, from.Lon, to.Lat, to.Lon, i / (float)dots, out double lat, out double lon);
                bool flown = i / (float)dots <= RouteFraction;
                UiKit.DrawCircle(Pt(lat, lon), 2.5f * s, flown ? UiKit.Gold : new Color(1, 1, 1, 0.6f));
            }
            DrawAirport(from);
            DrawAirport(to);
            GeoMath.Interpolate(from.Lat, from.Lon, to.Lat, to.Lon, RouteFraction, out double plat, out double plon);
            var plane = Pt(plat, plon);
            UiKit.DrawCircle(plane, 12 * s, Color.white);
            UiKit.DrawCircle(plane, 8 * s, UiKit.Gold);

            // header
            var top = UiKit.R(0, 0, UiKit.VW, 56);
            UiKit.DrawPanel(top);
            GUI.Label(UiKit.R(14, 6, UiKit.VW - 200, 28), $"Flight {ticket.BookingRef}   {from.Code} -> {to.Code}", UiKit.Heading);
            GUI.Label(UiKit.R(14, 32, UiKit.VW - 200, 22), $"{from.Name} to {to.Name} · {ticket.DistanceKm:N0} km", UiKit.Small);

            // status panel
            var panel = UiKit.R(UiKit.VW / 2 - 300, UiKit.VH - 150, 600, 136);
            UiKit.DrawPanel(panel);
            var phase = CurrentPhase();
            GUI.Label(new Rect(panel.x + 18 * s, panel.y + 12 * s, panel.width - 36 * s, 30 * s), phase.title, UiKit.Heading);
            GUI.Label(new Rect(panel.x + 18 * s, panel.y + 44 * s, panel.width - 36 * s, 24 * s), phase.text, UiKit.Label);
            var bar = new Rect(panel.x + 18 * s, panel.y + 80 * s, panel.width - 180 * s, 14 * s);
            UiKit.Fill(bar, new Color(1, 1, 1, 0.15f));
            UiKit.Fill(new Rect(bar.x, bar.y, bar.width * Progress, bar.height), UiKit.Gold);
            float realHours = (float)ticket.DistanceKm / 800f + 0.5f;
            GUI.Label(new Rect(bar.x, bar.yMax + 4 * s, bar.width, 22 * s),
                $"Simulated flight time {(int)realHours}h {(int)(realHours % 1 * 60):00}m", UiKit.Small);
            if (GUI.Button(new Rect(panel.xMax - 150 * s, panel.y + 70 * s, 132 * s, 48 * s), "Skip", UiKit.Button) && !landed)
                Land();
        }

        (float end, string title, string text) CurrentPhase()
        {
            foreach (var p in Phases) if (Progress <= p.end) return p;
            return Phases[Phases.Length - 1];
        }

        void DrawAirport(Airport a)
        {
            var p = Pt(a.Lat, a.Lon);
            UiKit.DrawCircle(p, 7 * UiKit.S, new Color(0.3f, 0.75f, 1f));
            UiKit.ShadowLabel(new Rect(p.x + 10 * UiKit.S, p.y - 11 * UiKit.S, 80 * UiKit.S, 22 * UiKit.S), a.Code, UiKit.Heading, Color.white);
        }

        Vector2 Pt(double lat, double lon)
        {
            vp.LatLonToScreen(lat, lon, out double x, out double y);
            return new Vector2((float)x, (float)y);
        }

        void FitRoute()
        {
            GeoMath.Project(from.Lat, from.Lon, out double u1, out double v1);
            GeoMath.Project(to.Lat, to.Lon, out double u2, out double v2);
            GeoMath.Interpolate(from.Lat, from.Lon, to.Lat, to.Lon, 0.5, out double mlat, out double mlon);
            double baseW = System.Math.Max(vp.ScreenW, vp.ScreenH * 2);
            double du = System.Math.Max(0.002, System.Math.Abs(u2 - u1));
            double dv = System.Math.Max(0.002, System.Math.Abs(v2 - v1));
            double zoom = System.Math.Min(0.55 * vp.ScreenW / (du * baseW), 0.45 * vp.ScreenH / (dv * baseW / 2));
            vp.CenterOn(mlat, mlon, System.Math.Min(10, zoom));
        }
    }
}
