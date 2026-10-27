using UnityEngine;

namespace WorldTour
{
    /// <summary>Orbit camera that follows the player and pulls in to avoid clipping through buildings.</summary>
    public sealed class ThirdPersonCamera : MonoBehaviour
    {
        public bool InputEnabled = true;
        Transform target;
        float yaw, pitch = 14f, distance = 6.5f;
        Vector3 smoothedPos;
        const float PivotHeight = 1.6f;

        public static ThirdPersonCamera Attach(Camera cam, Transform target)
        {
            var rig = cam.GetComponent<ThirdPersonCamera>();
            if (rig == null) rig = cam.gameObject.AddComponent<ThirdPersonCamera>();
            rig.target = target;
            rig.yaw = target.eulerAngles.y;
            rig.pitch = 14f;
            rig.enabled = true;
            rig.Snap();
            return rig;
        }

        public void Detach()
        {
            target = null;
            enabled = false;
        }

        void Snap()
        {
            smoothedPos = DesiredPosition();
            transform.position = smoothedPos;
            transform.LookAt(Pivot);
        }

        Vector3 Pivot => target.position + Vector3.up * PivotHeight;

        Vector3 DesiredPosition()
        {
            var rot = Quaternion.Euler(pitch, yaw, 0);
            Vector3 dir = rot * Vector3.back;
            float dist = distance;
            if (Physics.SphereCast(Pivot, 0.3f, dir, out var hit, distance, ~0, QueryTriggerInteraction.Ignore))
                dist = Mathf.Max(0.8f, hit.distance - 0.1f);
            return Pivot + dir * dist;
        }

        void LateUpdate()
        {
            if (target == null) return;
            if (InputEnabled)
            {
                Vector2 look = TouchControls.Look * (0.18f * Settings.LookSensitivity);
                yaw += look.x;
                pitch = Mathf.Clamp(pitch - look.y, -8f, 65f);
                distance = Mathf.Clamp(distance - TouchControls.Zoom, 3f, 14f);
            }
            var desired = DesiredPosition();
            // follow tightly when pulled in by a wall, ease otherwise
            smoothedPos = Vector3.Lerp(smoothedPos, desired, 1 - Mathf.Exp(-14f * Time.deltaTime));
            if ((desired - Pivot).sqrMagnitude < (smoothedPos - Pivot).sqrMagnitude) smoothedPos = desired;
            transform.position = smoothedPos;
            transform.LookAt(Pivot);
        }
    }
}
