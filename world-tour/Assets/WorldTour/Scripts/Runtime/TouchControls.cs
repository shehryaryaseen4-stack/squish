using UnityEngine;

namespace WorldTour
{
    /// <summary>
    /// Unified movement/look input: keyboard + mouse on desktop, a virtual
    /// joystick (left) and drag-to-look (anywhere else) on touch screens.
    /// Uses the legacy Input Manager (Player Settings: Active Input Handling = Old or Both).
    /// </summary>
    public static class TouchControls
    {
        public static Vector2 Move { get; private set; }
        public static Vector2 Look { get; private set; }
        public static float Zoom { get; private set; }
        public static bool Run { get; private set; }
        public static bool MoveFromJoystick { get; private set; }

        /// <summary>Joystick centre in IMGUI coordinates (y down) and radius in pixels.</summary>
        public static Vector2 StickCenter { get; private set; }
        public static float StickRadius { get; private set; }
        public static Vector2 StickKnob { get; private set; }
        public static bool StickActive => stickFinger != NoFinger;

        const int NoFinger = -99, MouseFinger = -1;
        static int stickFinger = NoFinger, lookFinger = NoFinger;
        static Vector2 lastLookPos;

        static Vector2 Gui(Vector2 screenPos) => new Vector2(screenPos.x, Screen.height - screenPos.y);

        public static void UpdateInput()
        {
            StickRadius = 70 * UiKit.S;
            StickCenter = new Vector2(UiKit.Safe.x + 120 * UiKit.S, UiKit.Safe.yMax - 120 * UiKit.S);
            Vector2 stick = Vector2.zero, look = Vector2.zero;

            if (Input.touchCount > 0)
            {
                for (int i = 0; i < Input.touchCount; i++)
                {
                    var t = Input.GetTouch(i);
                    var pos = Gui(t.position);
                    if (t.phase == TouchPhase.Began)
                    {
                        if (stickFinger == NoFinger && Vector2.Distance(pos, StickCenter) < StickRadius * 1.7f) stickFinger = t.fingerId;
                        else if (lookFinger == NoFinger && !UiKit.IsBlocked(pos)) { lookFinger = t.fingerId; lastLookPos = pos; }
                    }
                    bool ended = t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled;
                    if (t.fingerId == stickFinger)
                    {
                        if (ended) stickFinger = NoFinger; else stick = StickVector(pos);
                    }
                    else if (t.fingerId == lookFinger)
                    {
                        if (ended) lookFinger = NoFinger;
                        else { look += pos - lastLookPos; lastLookPos = pos; }
                    }
                }
                Zoom = 0;
            }
            else
            {
                if (stickFinger >= 0 || lookFinger >= 0) { stickFinger = NoFinger; lookFinger = NoFinger; }
                var mouse = Gui(Input.mousePosition);
                if (Input.GetMouseButtonDown(0) || Input.GetMouseButtonDown(1))
                {
                    if (Input.GetMouseButtonDown(0) && Vector2.Distance(mouse, StickCenter) < StickRadius * 1.7f) stickFinger = MouseFinger;
                    else if (!UiKit.IsBlocked(mouse)) { lookFinger = MouseFinger; lastLookPos = mouse; }
                }
                if (!Input.GetMouseButton(0) && !Input.GetMouseButton(1)) { stickFinger = NoFinger; lookFinger = NoFinger; }
                if (stickFinger == MouseFinger) stick = StickVector(mouse);
                if (lookFinger == MouseFinger) { look = mouse - lastLookPos; lastLookPos = mouse; }
                Zoom = Input.mouseScrollDelta.y * 0.8f;
            }

            Vector2 keys = Vector2.zero;
            if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) keys.y += 1;
            if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) keys.y -= 1;
            if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) keys.x += 1;
            if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) keys.x -= 1;

            MoveFromJoystick = stick.sqrMagnitude > 0.0001f;
            Move = MoveFromJoystick ? stick : Vector2.ClampMagnitude(keys, 1);
            Run = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            Look = look;
            StickKnob = StickCenter + new Vector2(stick.x, -stick.y) * StickRadius;
        }

        static Vector2 StickVector(Vector2 guiPos)
        {
            var d = (guiPos - StickCenter) / StickRadius;
            d.y = -d.y; // screen up = forward
            return Vector2.ClampMagnitude(d, 1f);
        }

        public static void Clear()
        {
            Move = Look = Vector2.zero;
            Zoom = 0;
            stickFinger = lookFinger = NoFinger;
        }
    }
}
