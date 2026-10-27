using System.Collections.Generic;
using UnityEngine;

namespace WorldTour
{
    /// <summary>
    /// Shared IMGUI helpers. Layout is written in "virtual units" (720 units =
    /// safe-area height at UI scale 1) and converted to real pixels, so text is
    /// rendered at native resolution instead of being scaled up blurry.
    /// </summary>
    public static class UiKit
    {
        public static float UserScale = 1f;
        public static float S { get; private set; } = 1f;
        public static Rect Safe { get; private set; }
        /// <summary>Safe-area size in virtual units.</summary>
        public static float VW => Safe.width / S;
        public static float VH => Safe.height / S;

        public static GUIStyle Title, Heading, Label, Small, Button, BigButton, Panel, TextField, Toast, MapLabel, Tag, CenterLabel, CenterSmall, RightHeading;
        public static Texture2D White, Circle;

        static readonly List<Rect> blockers = new List<Rect>();
        static int lastFontScaleKey = -1;

        public static readonly Color Gold = new Color(1f, 0.78f, 0.2f);
        public static readonly Color Green = new Color(0.35f, 0.9f, 0.45f);
        public static readonly Color Grey = new Color(0.75f, 0.75f, 0.78f);
        public static readonly Color Red = new Color(1f, 0.45f, 0.4f);
        public static readonly Color PanelColor = new Color(0.07f, 0.09f, 0.13f, 0.92f);

        /// <summary>Call at the start of every OnGUI.</summary>
        public static void Begin()
        {
            var sa = Screen.safeArea;
            // Screen.safeArea is bottom-left origin; IMGUI is top-left.
            Safe = new Rect(sa.x, Screen.height - sa.yMax, sa.width, sa.height);
            S = Mathf.Max(0.5f, Safe.height / 720f * UserScale);
            if (Event.current.type == EventType.Layout) blockers.Clear();
            EnsureStyles();
        }

        /// <summary>Virtual rect (relative to the safe area) to real pixels.</summary>
        public static Rect R(float x, float y, float w, float h) => new Rect(Safe.x + x * S, Safe.y + y * S, w * S, h * S);

        /// <summary>Marks a screen area as UI so map/camera input ignores it.</summary>
        public static void Block(Rect r)
        {
            if (Event.current.type == EventType.Layout) blockers.Add(r);
        }

        public static bool IsBlocked(Vector2 guiPos)
        {
            foreach (var r in blockers) if (r.Contains(guiPos)) return true;
            return false;
        }

        public static void DrawPanel(Rect r)
        {
            Block(r);
            GUI.Box(r, GUIContent.none, Panel);
        }

        public static void Fill(Rect r, Color c)
        {
            var old = GUI.color;
            GUI.color = c;
            GUI.DrawTexture(r, White);
            GUI.color = old;
        }

        public static bool Btn(Rect r, string text, bool enabled = true, GUIStyle style = null)
        {
            Block(r);
            bool wasEnabled = GUI.enabled;
            GUI.enabled = wasEnabled && enabled;
            bool clicked = GUI.Button(r, text, style ?? Button);
            GUI.enabled = wasEnabled;
            return clicked;
        }

        public static void ShadowLabel(Rect r, string text, GUIStyle style, Color color)
        {
            var old = style.normal.textColor;
            style.normal.textColor = new Color(0, 0, 0, 0.8f);
            GUI.Label(new Rect(r.x + 1, r.y + 1, r.width, r.height), text, style);
            style.normal.textColor = color;
            GUI.Label(r, text, style);
            style.normal.textColor = old;
        }

        public static void DrawCircle(Vector2 center, float radiusPx, Color c)
        {
            var old = GUI.color;
            GUI.color = c;
            GUI.DrawTexture(new Rect(center.x - radiusPx, center.y - radiusPx, radiusPx * 2, radiusPx * 2), Circle);
            GUI.color = old;
        }

        public static string Coins(long amount) => amount.ToString("N0") + " c";

        static void EnsureStyles()
        {
            if (White == null)
            {
                White = Texture2D.whiteTexture;
                Circle = MakeCircle(64);
            }
            int key = Mathf.RoundToInt(S * 100);
            if (key == lastFontScaleKey && Title != null) return;
            lastFontScaleKey = key;

            int F(float size) => Mathf.Max(8, Mathf.RoundToInt(size * S));
            var panelTex = MakeTex(PanelColor);

            Title = new GUIStyle(GUI.skin.label) { fontSize = F(40), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, wordWrap = true };
            Title.normal.textColor = Color.white;
            Heading = new GUIStyle(GUI.skin.label) { fontSize = F(22), fontStyle = FontStyle.Bold, wordWrap = true };
            Heading.normal.textColor = Color.white;
            Label = new GUIStyle(GUI.skin.label) { fontSize = F(16), wordWrap = true, richText = true };
            Label.normal.textColor = new Color(0.92f, 0.93f, 0.95f);
            Small = new GUIStyle(Label) { fontSize = F(13) };
            Small.normal.textColor = new Color(0.78f, 0.8f, 0.84f);
            Tag = new GUIStyle(Small) { fontStyle = FontStyle.Bold };
            MapLabel = new GUIStyle(GUI.skin.label) { fontSize = F(13), alignment = TextAnchor.MiddleCenter, wordWrap = false, clipping = TextClipping.Overflow };
            Button = new GUIStyle(GUI.skin.button) { fontSize = F(16), wordWrap = true };
            Button.padding = new RectOffset(F(8), F(8), F(4), F(4));
            BigButton = new GUIStyle(Button) { fontSize = F(22), fontStyle = FontStyle.Bold };
            Panel = new GUIStyle(GUI.skin.box);
            Panel.normal.background = panelTex;
            TextField = new GUIStyle(GUI.skin.textField) { fontSize = F(16), alignment = TextAnchor.MiddleLeft };
            TextField.padding = new RectOffset(F(8), F(8), F(4), F(4));
            CenterLabel = new GUIStyle(Label) { alignment = TextAnchor.MiddleCenter };
            CenterSmall = new GUIStyle(Small) { alignment = TextAnchor.MiddleCenter };
            RightHeading = new GUIStyle(Heading) { alignment = TextAnchor.MiddleRight };
            Toast = new GUIStyle(Label) { fontSize = F(18), alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
        }

        static Texture2D MakeTex(Color c)
        {
            var t = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            t.SetPixel(0, 0, c);
            t.Apply();
            return t;
        }

        static Texture2D MakeCircle(int size)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false);
            float r = size / 2f;
            var px = new Color32[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(r, r));
                    float a = Mathf.Clamp01(r - d);
                    // dark outline ring so markers read on any background
                    float shade = d > r - size * 0.12f ? 0.15f : 1f;
                    px[y * size + x] = new Color(shade, shade, shade, a);
                }
            t.SetPixels32(px);
            t.Apply();
            return t;
        }
    }

    /// <summary>Short on-screen feedback messages (purchases, rewards, errors).</summary>
    public sealed class Toasts
    {
        struct Item { public string Text; public Color Color; public float Until; }
        readonly List<Item> items = new List<Item>();

        public void Show(string text, Color color, float seconds = 3f)
        {
            items.Add(new Item { Text = text, Color = color, Until = Time.unscaledTime + seconds });
            if (items.Count > 4) items.RemoveAt(0);
        }

        public void Draw()
        {
            items.RemoveAll(i => i.Until < Time.unscaledTime);
            for (int i = 0; i < items.Count; i++)
            {
                var r = UiKit.R(UiKit.VW / 2 - 260, 80 + i * 46, 520, 40);
                UiKit.Fill(r, new Color(0, 0, 0, 0.75f));
                UiKit.ShadowLabel(r, items[i].Text, UiKit.Toast, items[i].Color);
            }
        }
    }

    /// <summary>
    /// Vertical flowing layout inside a scrollable panel (real pixels).
    /// Supports drag-to-scroll for touch screens.
    /// </summary>
    public sealed class UiFlow
    {
        Vector2 scroll;
        float contentHeight;
        float x, y, w;
        Rect inner;

        public void Begin(Rect panel)
        {
            UiKit.DrawPanel(panel);
            float pad = 14 * UiKit.S;
            inner = new Rect(panel.x + pad, panel.y + pad, panel.width - pad * 2, panel.height - pad * 2);
            var e = Event.current;
            if (e.type == EventType.MouseDrag && inner.Contains(e.mousePosition))
            {
                scroll.y = Mathf.Clamp(scroll.y - e.delta.y, 0, Mathf.Max(0, contentHeight - inner.height));
                e.Use();
            }
            if (e.type == EventType.ScrollWheel && inner.Contains(e.mousePosition))
            {
                scroll.y = Mathf.Clamp(scroll.y + e.delta.y * 20 * UiKit.S, 0, Mathf.Max(0, contentHeight - inner.height));
                e.Use();
            }
            bool overflow = contentHeight > inner.height;
            float bar = overflow ? 16 * UiKit.S : 0;
            scroll = GUI.BeginScrollView(inner, scroll, new Rect(0, 0, inner.width - bar, Mathf.Max(contentHeight, inner.height)));
            x = 0; y = 0; w = inner.width - bar;
        }

        public void ResetScroll() => scroll = Vector2.zero;

        public void Label(string text, GUIStyle style)
        {
            float h = style.CalcHeight(new GUIContent(text), w);
            GUI.Label(new Rect(x, y, w, h), text, style);
            y += h + 4 * UiKit.S;
        }

        public void ColorLabel(string text, GUIStyle style, Color color)
        {
            var old = style.normal.textColor;
            style.normal.textColor = color;
            Label(text, style);
            style.normal.textColor = old;
        }

        public bool Button(string text, bool enabled = true, float height = 44)
        {
            var r = new Rect(x, y, w, height * UiKit.S);
            y += r.height + 6 * UiKit.S;
            bool was = GUI.enabled;
            GUI.enabled = was && enabled;
            bool clicked = GUI.Button(r, text, UiKit.Button);
            GUI.enabled = was;
            return clicked;
        }

        public void Space(float v) => y += v * UiKit.S;

        public void End()
        {
            GUI.EndScrollView();
            if (Event.current.type == EventType.Repaint) contentHeight = y;
        }
    }
}
