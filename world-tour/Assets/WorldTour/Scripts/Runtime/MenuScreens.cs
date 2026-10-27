using System.Linq;
using UnityEngine;
using WorldTour.Core;

namespace WorldTour
{
    /// <summary>Main menu, arrival, pause, profile and settings screens.</summary>
    public sealed class MenuScreens
    {
        readonly GameManager gm;
        readonly UiFlow profileFlow = new UiFlow();
        readonly UiFlow settingsFlow = new UiFlow();
        float confirmNewUntil, confirmResetUntil;

        public MenuScreens(GameManager gm) { this.gm = gm; }

        static Rect Centered(float w, float h) => UiKit.R(UiKit.VW / 2 - w / 2, UiKit.VH / 2 - h / 2, w, h);

        public void DrawMainMenu()
        {
            UiKit.Fill(new Rect(0, 0, Screen.width, Screen.height), new Color(0.06f, 0.1f, 0.16f));
            float s = UiKit.S;
            var panel = Centered(440, 520);
            UiKit.DrawPanel(panel);
            GUI.Label(new Rect(panel.x, panel.y + 24 * s, panel.width, 50 * s), "WORLD TOUR", UiKit.Title);
            var sub = UiKit.CenterSmall;
            GUI.Label(new Rect(panel.x, panel.y + 78 * s, panel.width, 24 * s), "Open World Travel Simulator · prototype", sub);

            float y = panel.y + 130 * s, x = panel.x + 50 * s, w = panel.width - 100 * s, h = 58 * s;
            bool Button(string text, bool enabled = true)
            {
                bool was = GUI.enabled;
                GUI.enabled = enabled;
                bool c = GUI.Button(new Rect(x, y, w, h), text, UiKit.BigButton);
                GUI.enabled = was;
                y += h + 14 * s;
                return c;
            }

            bool hasSave = SaveSystem.HasSave;
            if (Button("Continue", hasSave)) gm.ContinueGame();
            bool confirming = Time.unscaledTime < confirmNewUntil;
            if (Button(confirming ? "Tap again to overwrite save" : "New Game"))
            {
                if (hasSave && !confirming) confirmNewUntil = Time.unscaledTime + 3f;
                else { confirmNewUntil = 0; gm.NewGame(); }
            }
            if (Button("Settings")) gm.Show(GameScreen.Settings);
            if (Application.platform != RuntimePlatform.WebGLPlayer && Button("Quit")) Application.Quit();

            GUI.Label(new Rect(panel.x, panel.yMax - 34 * s, panel.width, 24 * s), "Map data: Natural Earth (public domain)", sub);
        }

        public void DrawArrival()
        {
            var a = gm.LastArrival;
            if (a == null) { gm.OpenMap(); return; }
            UiKit.Fill(new Rect(0, 0, Screen.width, Screen.height), new Color(0.06f, 0.1f, 0.16f));
            float s = UiKit.S;
            var d = a.Destination;
            var airport = gm.Db.GetAirport(d.AirportCode);
            var panel = Centered(520, 400);
            UiKit.DrawPanel(panel);
            GUI.Label(new Rect(panel.x, panel.y + 20 * s, panel.width, 50 * s), "Welcome to " + d.Name, UiKit.Title);
            string body = $"You have landed at {airport.Name} ({airport.Code}), {gm.Db.CountryName(d.CountryId)}.\n\n";
            if (a.FirstVisit) body += $"<color=#7CFC8A><b>First visit reward: +{a.Reward} coins</b></color>\n";
            body += $"Balance: <b>{UiKit.Coins(gm.Profile.Coins)}</b>";
            if (!d.IsExplorable) body += "\n\nThe 3D area for this destination has not been built yet.";
            GUI.Label(new Rect(panel.x + 30 * s, panel.y + 90 * s, panel.width - 60 * s, 170 * s), body, UiKit.Label);
            float by = panel.yMax - 76 * s;
            if (d.IsExplorable)
            {
                if (GUI.Button(new Rect(panel.x + 30 * s, by, 260 * s, 56 * s), "Start exploring", UiKit.BigButton)) gm.EnterCity(d);
                if (GUI.Button(new Rect(panel.xMax - 200 * s, by, 170 * s, 56 * s), "World map", UiKit.Button)) gm.OpenMap();
            }
            else if (GUI.Button(new Rect(panel.x + 30 * s, by, panel.width - 60 * s, 56 * s), "World map", UiKit.BigButton)) gm.OpenMap();
        }

        public void DrawPause()
        {
            UiKit.Fill(new Rect(0, 0, Screen.width, Screen.height), new Color(0, 0, 0, 0.55f));
            float s = UiKit.S;
            var panel = Centered(400, 500);
            UiKit.DrawPanel(panel);
            GUI.Label(new Rect(panel.x, panel.y + 16 * s, panel.width, 44 * s), "Paused", UiKit.Title);
            float y = panel.y + 80 * s, x = panel.x + 40 * s, w = panel.width - 80 * s, h = 52 * s;
            bool Button(string t) { bool c = GUI.Button(new Rect(x, y, w, h), t, UiKit.Button); y += h + 10 * s; return c; }

            if (Button("Resume")) gm.Resume();
            if (Button("Save game")) gm.SaveNow(true);
            if (Button("World map")) gm.OpenMap();
            if (Button("Profile & spending")) gm.Show(GameScreen.Profile);
            if (Button("Settings")) gm.Show(GameScreen.Settings);
            if (Button("Save & main menu")) gm.ToMainMenu();
        }

        public void DrawProfile()
        {
            UiKit.Fill(new Rect(0, 0, Screen.width, Screen.height), new Color(0.05f, 0.07f, 0.1f, 0.85f));
            var p = gm.Profile;
            var db = gm.Db;
            var panel = Centered(Mathf.Min(720, UiKit.VW - 20), UiKit.VH - 20);
            profileFlow.Begin(panel);
            profileFlow.Label("Traveller profile", UiKit.Heading);
            profileFlow.ColorLabel("Coins: " + UiKit.Coins(p.Coins), UiKit.Heading, UiKit.Gold);
            profileFlow.Label($"Current location: {gm.Travel.Current.Name}, {db.CountryName(gm.Travel.Current.CountryId)}", UiKit.Label);
            profileFlow.Label($"Flights taken: {p.FlightsTaken}   ·   Total spent: {UiKit.Coins(p.TotalSpent)}   ·   Total earned: {UiKit.Coins(p.TotalEarned)}", UiKit.Label);

            var visited = p.VisitedDestinations.Select(id => db.GetDestination(id)?.Name).Where(n => n != null);
            profileFlow.Label($"Destinations visited ({p.VisitedDestinations.Count}/{db.Destinations.Count}): " + string.Join(", ", visited), UiKit.Label);
            int landmarkTotal = db.Destinations.Where(d => d.Environment != null).Sum(d => d.Environment.Landmarks.Count);
            profileFlow.Label($"Landmarks visited: {p.VisitedLandmarks.Count}/{landmarkTotal}", UiKit.Label);

            profileFlow.Space(8);
            profileFlow.Label("<b>Spending history</b> (latest first)", UiKit.Label);
            if (p.History.Count == 0) profileFlow.Label("No transactions yet.", UiKit.Small);
            for (int i = p.History.Count - 1; i >= 0; i--)
            {
                var t = p.History[i];
                string amount = t.Amount >= 0 ? $"<color=#7CFC8A>+{t.Amount}</color>" : $"<color=#FF8A80>{t.Amount}</color>";
                profileFlow.Label($"{t.TimeUtc.ToLocalTime():dd MMM HH:mm}   {amount}   {t.Category}: {t.Description}   (balance {t.BalanceAfter})", UiKit.Small);
            }
            profileFlow.Space(8);
            if (profileFlow.Button("Back")) gm.Resume();
            profileFlow.End();
        }

        public void DrawSettings()
        {
            UiKit.Fill(new Rect(0, 0, Screen.width, Screen.height), new Color(0.05f, 0.07f, 0.1f, 0.9f));
            var panel = Centered(Mathf.Min(560, UiKit.VW - 20), UiKit.VH - 40);
            settingsFlow.Begin(panel);
            settingsFlow.Label("Settings", UiKit.Heading);

            settingsFlow.Label($"Interface size: {Settings.UiScale:0.##}x", UiKit.Label);
            foreach (var v in new[] { 0.85f, 1f, 1.2f, 1.4f })
                if (settingsFlow.Button((Mathf.Approximately(v, Settings.UiScale) ? "> " : "") + v + "x", true, 38)) { Settings.UiScale = v; Settings.Save(); }

            string currentQuality = QualitySettings.names.Length > 0 ? QualitySettings.names[QualitySettings.GetQualityLevel()] : "-";
            settingsFlow.Label("Graphics quality: " + currentQuality, UiKit.Label);
            for (int i = 0; i < QualitySettings.names.Length; i++)
                if (settingsFlow.Button((i == QualitySettings.GetQualityLevel() ? "> " : "") + QualitySettings.names[i], true, 38)) { Settings.Quality = i; Settings.Save(); }

            settingsFlow.Label($"Camera sensitivity: {Settings.LookSensitivity:0.#}x", UiKit.Label);
            foreach (var v in new[] { 0.5f, 1f, 1.5f, 2f })
                if (settingsFlow.Button((Mathf.Approximately(v, Settings.LookSensitivity) ? "> " : "") + v + "x", true, 38)) { Settings.LookSensitivity = v; Settings.Save(); }

            settingsFlow.Space(10);
            if (SaveSystem.HasSave)
            {
                bool confirming = Time.unscaledTime < confirmResetUntil;
                if (settingsFlow.Button(confirming ? "Tap again to DELETE all progress" : "Reset progress"))
                {
                    if (!confirming) confirmResetUntil = Time.unscaledTime + 3f;
                    else
                    {
                        confirmResetUntil = 0;
                        gm.ResetProgress();
                    }
                }
            }
            if (settingsFlow.Button("Back")) gm.CloseSettings();
            settingsFlow.End();
        }
    }
}
