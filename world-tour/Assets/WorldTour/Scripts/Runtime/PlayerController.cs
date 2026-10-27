using UnityEngine;

namespace WorldTour
{
    /// <summary>Third-person walking character built from primitives, driven by a CharacterController.</summary>
    public sealed class PlayerController : MonoBehaviour
    {
        public bool InputEnabled = true;
        public float WalkSpeed = 4.2f;
        public float RunSpeed = 8f;
        public float Gravity = -20f;

        CharacterController cc;
        Transform visual;
        Vector3 spawn;
        float verticalSpeed;
        float bobPhase;

        public float CurrentSpeed { get; private set; }

        public static PlayerController Create(Vector3 position, float yaw)
        {
            var go = new GameObject("Player");
            go.transform.SetPositionAndRotation(position, Quaternion.Euler(0, yaw, 0));
            var p = go.AddComponent<PlayerController>();
            p.spawn = position;
            p.cc = go.AddComponent<CharacterController>();
            p.cc.height = 1.8f;
            p.cc.radius = 0.35f;
            p.cc.center = new Vector3(0, 0.9f, 0);
            p.cc.stepOffset = 0.4f;
            p.cc.slopeLimit = 45f;

            p.visual = new GameObject("Visual").transform;
            p.visual.SetParent(go.transform, false);
            Piece(p.visual, PrimitiveType.Capsule, new Vector3(0, 0.82f, 0), new Vector3(0.62f, 0.75f, 0.5f), new Color(0.15f, 0.55f, 0.6f));
            Piece(p.visual, PrimitiveType.Sphere, new Vector3(0, 1.62f, 0), Vector3.one * 0.38f, new Color(0.85f, 0.65f, 0.5f));
            Piece(p.visual, PrimitiveType.Cube, new Vector3(0, 1.82f, 0.04f), new Vector3(0.36f, 0.08f, 0.42f), new Color(0.9f, 0.3f, 0.2f)); // cap
            Piece(p.visual, PrimitiveType.Cube, new Vector3(0, 1.06f, -0.3f), new Vector3(0.42f, 0.55f, 0.2f), new Color(0.85f, 0.55f, 0.15f)); // backpack
            return p;
        }

        static void Piece(Transform parent, PrimitiveType type, Vector3 pos, Vector3 scale, Color c)
        {
            var go = GameObject.CreatePrimitive(type);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = Mats.Get(c);
        }

        void Update()
        {
            Vector2 input = InputEnabled ? TouchControls.Move : Vector2.zero;
            bool run = InputEnabled && (TouchControls.Run || input.magnitude > 0.92f && TouchControls.MoveFromJoystick);
            Vector3 move = Vector3.zero;
            var cam = Camera.main;
            if (input.sqrMagnitude > 0.0025f && cam != null)
            {
                Vector3 fwd = Vector3.ProjectOnPlane(cam.transform.forward, Vector3.up).normalized;
                Vector3 right = Vector3.Cross(Vector3.up, fwd);
                move = (fwd * input.y + right * input.x);
                if (move.sqrMagnitude > 1) move.Normalize();
                var targetRot = Quaternion.LookRotation(move, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, 1 - Mathf.Exp(-12f * Time.deltaTime));
            }
            float speed = run ? RunSpeed : WalkSpeed;
            CurrentSpeed = move.magnitude * speed;

            if (cc.isGrounded && verticalSpeed < 0) verticalSpeed = -2f;
            verticalSpeed += Gravity * Time.deltaTime;
            cc.Move((move * speed + Vector3.up * verticalSpeed) * Time.deltaTime);

            // simple walk bob in place of an animation rig
            if (CurrentSpeed > 0.1f) bobPhase += Time.deltaTime * CurrentSpeed * 2.2f;
            else bobPhase = Mathf.MoveTowards(bobPhase, Mathf.Round(bobPhase / Mathf.PI) * Mathf.PI, Time.deltaTime * 4f);
            visual.localPosition = new Vector3(0, Mathf.Abs(Mathf.Sin(bobPhase)) * 0.08f, 0);

            if (transform.position.y < -20f) Respawn();
        }

        public void Respawn()
        {
            cc.enabled = false;
            transform.position = spawn;
            cc.enabled = true;
            verticalSpeed = 0;
        }
    }
}
