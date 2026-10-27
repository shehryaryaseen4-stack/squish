using System.Collections.Generic;
using UnityEngine;
using WorldTour.Core;

namespace WorldTour
{
    /// <summary>Shared, instancing-enabled materials keyed by colour (keeps draw calls and memory low).</summary>
    public static class Mats
    {
        static Material baseMaterial;
        static readonly Dictionary<Color32, Material> cache = new Dictionary<Color32, Material>();

        public static Material Get(Color c)
        {
            Color32 key = c;
            if (cache.TryGetValue(key, out var m) && m != null) return m;
            if (baseMaterial == null)
            {
                // Use the render pipeline's own default material so this works in Built-in and URP.
                var tmp = GameObject.CreatePrimitive(PrimitiveType.Cube);
                baseMaterial = tmp.GetComponent<Renderer>().sharedMaterial;
                Object.Destroy(tmp);
            }
            m = new Material(baseMaterial) { color = c, enableInstancing = true, name = "WT_" + ColorUtility.ToHtmlStringRGB(c) };
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.08f);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.08f);
            cache[key] = m;
            return m;
        }

        public static Color Hex(string hex, Color fallback)
        {
            return ColorUtility.TryParseHtmlString(hex, out var c) ? c : fallback;
        }
    }

    /// <summary>Runtime state for one landmark in a loaded city.</summary>
    public sealed class LandmarkInfo
    {
        public LandmarkSpec Spec;
        public Vector3 Position;
        public float InteractRadius;
        public Transform Marker;
        public float MarkerHeight;
        Renderer markerRenderer;

        public LandmarkInfo(LandmarkSpec spec, Vector3 pos, Transform marker, float markerHeight)
        {
            Spec = spec;
            Position = pos;
            InteractRadius = spec.Radius + 8f;
            Marker = marker;
            MarkerHeight = markerHeight;
            markerRenderer = marker.GetComponent<Renderer>();
        }

        public void MarkVisited() => markerRenderer.sharedMaterial = Mats.Get(new Color(0.6f, 0.6f, 0.62f));
    }

    /// <summary>A loaded explorable area. Destroying it frees everything it created.</summary>
    public sealed class CityEnvironment : MonoBehaviour
    {
        public Destination Destination;
        public Vector3 SpawnPoint;
        public float SpawnFacing;
        public readonly List<LandmarkInfo> Landmarks = new List<LandmarkInfo>();
        public readonly List<Light> DisabledSceneLights = new List<Light>();

        void Update()
        {
            float t = Time.time;
            foreach (var l in Landmarks)
            {
                l.Marker.localRotation = Quaternion.Euler(45, t * 60f, 45);
                var p = l.Position;
                l.Marker.position = new Vector3(p.x, l.MarkerHeight + Mathf.Sin(t * 2f) * 0.6f, p.z);
            }
        }

        public void Unload()
        {
            foreach (var l in DisabledSceneLights) if (l != null) l.enabled = true;
            Destroy(gameObject);
        }
    }

    /// <summary>
    /// Builds a small explorable area from a destination's EnvironmentSpec using
    /// primitives: road grid, city blocks, trees and typed landmarks. New cities
    /// only need data; new landmark styles need a builder method here.
    /// </summary>
    public static class CityBuilder
    {
        static Transform staticRoot;
        static System.Random rng;

        public static CityEnvironment Build(Destination dest)
        {
            var spec = dest.Environment;
            rng = new System.Random(spec.Seed);
            var root = new GameObject("City_" + dest.Id);
            var env = root.AddComponent<CityEnvironment>();
            env.Destination = dest;
            staticRoot = new GameObject("Static").transform;
            staticRoot.SetParent(root.transform, false);

            SetupLighting(root.transform, env);

            float H = spec.HalfSize;
            var ground = Mats.Hex(spec.GroundColor, new Color(0.6f, 0.55f, 0.45f));
            Part(PrimitiveType.Cube, new Vector3(0, -0.5f, 0), new Vector3(H * 2 + 40, 1, H * 2 + 40), ground);
            Part(PrimitiveType.Cube, new Vector3(0, -0.6f, 0), new Vector3(1500, 1, 1500), ground * 0.85f, collider: false);
            BuildBounds(root.transform, H);

            env.SpawnPoint = new Vector3(spec.SpawnX, 0.1f, spec.SpawnZ);
            BuildGrid(spec, env.SpawnPoint);
            BuildArrivalPoint(env.SpawnPoint);

            foreach (var l in spec.Landmarks) BuildLandmark(env, spec, l);

            // face the nearest landmark when arriving
            if (env.Landmarks.Count > 0)
            {
                LandmarkInfo nearest = env.Landmarks[0];
                foreach (var l in env.Landmarks)
                    if (Vector3.Distance(l.Position, env.SpawnPoint) < Vector3.Distance(nearest.Position, env.SpawnPoint)) nearest = l;
                var dir = nearest.Position - env.SpawnPoint;
                env.SpawnFacing = Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg;
            }

            StaticBatchingUtility.Combine(staticRoot.gameObject);
            return env;
        }

        static void SetupLighting(Transform root, CityEnvironment env)
        {
            foreach (var l in Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
                if (l.enabled && l.type == LightType.Directional) { l.enabled = false; env.DisabledSceneLights.Add(l); }

            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.transform.SetParent(root, false);
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.94f, 0.82f);
            sun.intensity = 1.15f;
            sun.shadows = LightShadows.Hard;
            sun.shadowStrength = 0.7f;
            sun.transform.rotation = Quaternion.Euler(48, -35, 0);
            RenderSettings.sun = sun;

            var haze = new Color(0.78f, 0.82f, 0.86f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.7f, 0.82f);
            RenderSettings.ambientEquatorColor = new Color(0.55f, 0.52f, 0.48f);
            RenderSettings.ambientGroundColor = new Color(0.3f, 0.27f, 0.24f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = haze;
            RenderSettings.fogStartDistance = 120f;
            RenderSettings.fogEndDistance = 380f;
            var cam = GameManager.Instance.MainCamera;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = haze;
        }

        static void BuildBounds(Transform root, float H)
        {
            for (int i = 0; i < 4; i++)
            {
                var wall = new GameObject("Bound").AddComponent<BoxCollider>();
                wall.transform.SetParent(root, false);
                bool alongX = i < 2;
                float sign = i % 2 == 0 ? 1 : -1;
                wall.transform.localPosition = alongX ? new Vector3(0, 10, sign * (H + 2)) : new Vector3(sign * (H + 2), 10, 0);
                wall.size = alongX ? new Vector3(H * 2 + 8, 20, 4) : new Vector3(4, 20, H * 2 + 8);
            }
        }

        static bool InLandmarkGrounds(EnvironmentSpec spec, Vector3 p, float margin)
        {
            foreach (var l in spec.Landmarks)
                if (Flat(p - new Vector3(l.X, 0, l.Z)).magnitude < l.Radius + margin) return true;
            return false;
        }

        /// <summary>True where no buildings may go: landmark grounds and the arrival plaza.</summary>
        static bool Cleared(EnvironmentSpec spec, Vector3 spawn, Vector3 p, float margin)
            => Flat(p - spawn).magnitude < 14 + margin || InLandmarkGrounds(spec, p, margin);

        static Vector3 Flat(Vector3 v) => new Vector3(v.x, 0, v.z);

        static void BuildGrid(EnvironmentSpec spec, Vector3 spawn)
        {
            float pitch = spec.BlockSize + spec.RoadWidth;
            int n = Mathf.FloorToInt(spec.HalfSize * 2 / pitch);
            float start = -n * pitch / 2;
            var road = Mats.Hex(spec.RoadColor, Color.gray);
            var kerb = new Color(0.7f, 0.68f, 0.63f);
            var palette = new List<Color>();
            foreach (var hex in spec.BuildingColors) palette.Add(Mats.Hex(hex, Color.gray));
            if (palette.Count == 0) palette.Add(new Color(0.8f, 0.75f, 0.65f));

            // roads: one segment per block edge, skipped inside landmark grounds
            for (int k = 0; k <= n; k++)
                for (int i = 0; i < n; i++)
                {
                    float line = start + k * pitch, mid = start + (i + 0.5f) * pitch;
                    var a = new Vector3(mid, 0.02f, line);
                    if (!InLandmarkGrounds(spec, a, -6)) Part(PrimitiveType.Cube, a, new Vector3(pitch, 0.04f, spec.RoadWidth), road, collider: false);
                    var b = new Vector3(line, 0.02f, mid);
                    if (!InLandmarkGrounds(spec, b, -6)) Part(PrimitiveType.Cube, b, new Vector3(spec.RoadWidth, 0.04f, pitch), road, collider: false);
                }

            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                {
                    var c = new Vector3(start + (i + 0.5f) * pitch, 0, start + (j + 0.5f) * pitch);
                    if (Cleared(spec, spawn, c, spec.BlockSize * 0.6f)) continue;
                    // pavement slab
                    Part(PrimitiveType.Cube, c + Vector3.up * 0.08f, new Vector3(spec.BlockSize, 0.16f, spec.BlockSize), kerb, collider: false);
                    double roll = rng.NextDouble();
                    if (roll < 0.08) BuildPocketPark(spec, c);
                    else if (roll < 0.22) Building(c, spec.BlockSize - 6, spec.BlockSize - 6, Rand(spec.BuildingHeightMin, spec.BuildingHeightMax) * 1.2f, Pick(palette));
                    else
                    {
                        float lot = spec.BlockSize / 2 - 2.5f;
                        for (int q = 0; q < 4; q++)
                        {
                            var off = new Vector3((q % 2 == 0 ? -1 : 1) * (lot / 2 + 1), 0, (q < 2 ? -1 : 1) * (lot / 2 + 1));
                            Building(c + off, lot - Rand(0, 3), lot - Rand(0, 3), Rand(spec.BuildingHeightMin, spec.BuildingHeightMax), Pick(palette));
                        }
                    }
                }
        }

        static void Building(Vector3 c, float w, float d, float h, Color color)
        {
            Part(PrimitiveType.Cube, c + Vector3.up * h / 2, new Vector3(w, h, d), color);
            // roof parapet and a shop-front band give silhouettes without textures
            Part(PrimitiveType.Cube, c + Vector3.up * (h + 0.4f), new Vector3(w + 0.4f, 0.8f, d + 0.4f), color * 0.8f, collider: false);
            if (rng.NextDouble() < 0.6)
            {
                var band = Color.HSVToRGB((float)rng.NextDouble(), 0.55f, 0.85f);
                Part(PrimitiveType.Cube, c + Vector3.up * 3.2f, new Vector3(w + 0.3f, 0.9f, d + 0.3f), band, collider: false);
            }
        }

        static void BuildPocketPark(EnvironmentSpec spec, Vector3 c)
        {
            Part(PrimitiveType.Cube, c + Vector3.up * 0.18f, new Vector3(spec.BlockSize - 2, 0.1f, spec.BlockSize - 2), Mats.Hex(spec.ParkColor, Color.green), collider: false);
            for (int t = 0; t < 4; t++) Tree(c + new Vector3(Rand(-12, 12), 0, Rand(-12, 12)));
        }

        static void BuildArrivalPoint(Vector3 p)
        {
            Part(PrimitiveType.Cylinder, p + Vector3.up * 0.05f, new Vector3(16, 0.05f, 16), new Color(0.75f, 0.72f, 0.66f), collider: false);
            // signpost: "arrival point" (taxi stand comes in Phase 4)
            Part(PrimitiveType.Cube, p + new Vector3(5, 1.5f, 0), new Vector3(0.2f, 3, 0.2f), new Color(0.25f, 0.25f, 0.28f));
            Part(PrimitiveType.Cube, p + new Vector3(5, 3, 0), new Vector3(0.15f, 1, 2.4f), new Color(1f, 0.8f, 0.1f), collider: false);
        }

        static void Tree(Vector3 p)
        {
            float h = Rand(2.2f, 3.5f);
            Part(PrimitiveType.Cylinder, p + Vector3.up * h / 2, new Vector3(0.4f, h / 2, 0.4f), new Color(0.4f, 0.28f, 0.18f));
            float s = Rand(3f, 4.5f);
            Part(PrimitiveType.Sphere, p + Vector3.up * (h + s * 0.35f), new Vector3(s, s * 0.85f, s), new Color(0.25f, Rand(0.45f, 0.58f), 0.2f), collider: false);
        }

        // ---------------- landmarks ----------------

        static void BuildLandmark(CityEnvironment env, EnvironmentSpec spec, LandmarkSpec l)
        {
            var o = new Vector3(l.X, 0, l.Z);
            var groundColor = l.Park ? Mats.Hex(spec.ParkColor, Color.green) : new Color(0.78f, 0.7f, 0.58f);
            Part(PrimitiveType.Cylinder, o + Vector3.up * 0.06f, new Vector3(l.Radius * 2, 0.06f, l.Radius * 2), groundColor, collider: false);

            float top;
            switch (l.Type)
            {
                case "mosque": top = Mosque(o); break;
                case "fort": top = Fort(o); break;
                case "minar": top = Minar(o); break;
                case "bazaar": top = Bazaar(o); break;
                default: top = Generic(o); break;
            }
            if (l.Park)
                for (int i = 0; i < 14; i++)
                {
                    float a = i / 14f * Mathf.PI * 2 + Rand(-0.1f, 0.1f);
                    float r = l.Radius - Rand(3, 8);
                    Tree(o + new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r));
                }

            var marker = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(marker.GetComponent<Collider>());
            marker.name = "Marker_" + l.Id;
            marker.transform.SetParent(env.transform, false);
            marker.transform.localScale = Vector3.one * 2.4f;
            bool visited = GameManager.Instance.Profile.VisitedLandmarks.Contains(l.Id);
            var info = new LandmarkInfo(l, o, marker.transform, top + 6f);
            marker.GetComponent<Renderer>().sharedMaterial = Mats.Get(UiKit.Gold);
            if (visited) info.MarkVisited();
            env.Landmarks.Add(info);
        }

        /// <summary>Badshahi-style mosque: walled courtyard, prayer hall on the west with three domes, four minarets.</summary>
        static float Mosque(Vector3 o)
        {
            var red = new Color(0.66f, 0.3f, 0.23f);
            var marble = new Color(0.95f, 0.94f, 0.9f);
            const float half = 42, wallH = 8, gate = 6;
            Part(PrimitiveType.Cube, o + Vector3.up * 0.15f, new Vector3(half * 2, 0.3f, half * 2), new Color(0.8f, 0.55f, 0.45f));
            // walls with an east gateway
            Part(PrimitiveType.Cube, o + new Vector3(0, wallH / 2, half), new Vector3(half * 2, wallH, 2), red);
            Part(PrimitiveType.Cube, o + new Vector3(0, wallH / 2, -half), new Vector3(half * 2, wallH, 2), red);
            Part(PrimitiveType.Cube, o + new Vector3(-half, wallH / 2, 0), new Vector3(2, wallH, half * 2), red);
            float seg = half - gate;
            Part(PrimitiveType.Cube, o + new Vector3(half, wallH / 2, half - seg / 2), new Vector3(2, wallH, seg), red);
            Part(PrimitiveType.Cube, o + new Vector3(half, wallH / 2, -half + seg / 2), new Vector3(2, wallH, seg), red);
            Part(PrimitiveType.Cube, o + new Vector3(half, 7, gate + 2), new Vector3(5, 14, 4), red);
            Part(PrimitiveType.Cube, o + new Vector3(half, 7, -gate - 2), new Vector3(5, 14, 4), red);
            Part(PrimitiveType.Cube, o + new Vector3(half, 12.5f, 0), new Vector3(5, 3, gate * 2 + 8), red);
            Part(PrimitiveType.Sphere, o + new Vector3(half, 14.5f, 0), new Vector3(4, 3, 4), marble, collider: false);
            // prayer hall
            Part(PrimitiveType.Cube, o + new Vector3(-29, 7, 0), new Vector3(22, 14, 62), red);
            Part(PrimitiveType.Cube, o + new Vector3(-17.5f, 9, 0), new Vector3(1.5f, 18, 16), red * 1.1f);
            Part(PrimitiveType.Cube, o + new Vector3(-16.9f, 6.5f, 0), new Vector3(0.6f, 11, 9), new Color(0.35f, 0.15f, 0.12f), collider: false);
            for (int s = -1; s <= 1; s += 2)
                Part(PrimitiveType.Cube, o + new Vector3(-17.2f, 5, s * 19), new Vector3(0.6f, 8, 7), new Color(0.35f, 0.15f, 0.12f), collider: false);
            // three marble domes
            foreach (var (z, size) in new[] { (0f, 15f), (-19f, 10.5f), (19f, 10.5f) })
            {
                Part(PrimitiveType.Cylinder, o + new Vector3(-29, 15.2f, z), new Vector3(size * 0.75f, 1.2f, size * 0.75f), marble, collider: false);
                Part(PrimitiveType.Sphere, o + new Vector3(-29, 16.2f + size * 0.38f, z), new Vector3(size, size * 0.95f, size), marble, collider: false);
                Part(PrimitiveType.Cylinder, o + new Vector3(-29, 16.2f + size * 0.85f, z), new Vector3(0.4f, 1.6f, 0.4f), new Color(0.85f, 0.7f, 0.3f), collider: false);
            }
            // four corner minarets
            foreach (var c in new[] { new Vector3(1, 0, 1), new Vector3(1, 0, -1), new Vector3(-1, 0, 1), new Vector3(-1, 0, -1) })
            {
                var p = o + c * half;
                Part(PrimitiveType.Cylinder, p + Vector3.up * 21, new Vector3(4.2f, 21, 4.2f), red);
                Part(PrimitiveType.Cylinder, p + Vector3.up * 14, new Vector3(5.6f, 0.4f, 5.6f), marble, collider: false);
                Part(PrimitiveType.Cylinder, p + Vector3.up * 28, new Vector3(5.6f, 0.4f, 5.6f), marble, collider: false);
                Part(PrimitiveType.Cylinder, p + Vector3.up * 43.5f, new Vector3(4.6f, 1.5f, 4.6f), marble, collider: false);
                Part(PrimitiveType.Sphere, p + Vector3.up * 46, new Vector3(4, 3.6f, 4), marble, collider: false);
            }
            // courtyard pool
            Part(PrimitiveType.Cube, o + new Vector3(8, 0.35f, 0), new Vector3(9, 0.1f, 9), new Color(0.35f, 0.65f, 0.75f), collider: false);
            return 48;
        }

        /// <summary>Fort: crenellated brick walls, corner bastions, west gate, inner marble pavilion and garden.</summary>
        static float Fort(Vector3 o)
        {
            var brick = new Color(0.7f, 0.42f, 0.3f);
            var marble = new Color(0.93f, 0.92f, 0.88f);
            const float hx = 46, hz = 36, wallH = 12, gate = 6;
            void Wall(Vector3 center, Vector3 size, bool alongX)
            {
                Part(PrimitiveType.Cube, o + center + Vector3.up * wallH / 2, new Vector3(size.x, wallH, size.z), brick);
                float len = alongX ? size.x : size.z;
                for (float t = -len / 2 + 1.5f; t < len / 2; t += 4f)
                {
                    var off = alongX ? new Vector3(t, 0, 0) : new Vector3(0, 0, t);
                    Part(PrimitiveType.Cube, o + center + off + Vector3.up * (wallH + 0.8f), new Vector3(1.6f, 1.6f, 1.6f), brick * 0.95f, collider: false);
                }
            }
            Wall(new Vector3(0, 0, hz), new Vector3(hx * 2, 0, 3), true);
            Wall(new Vector3(0, 0, -hz), new Vector3(hx * 2, 0, 3), true);
            Wall(new Vector3(hx, 0, 0), new Vector3(3, 0, hz * 2), false);
            float seg = hz - gate;
            Wall(new Vector3(-hx, 0, hz - seg / 2), new Vector3(3, 0, seg), false);
            Wall(new Vector3(-hx, 0, -hz + seg / 2), new Vector3(3, 0, seg), false);
            // gate bastions and arch
            foreach (int s in new[] { -1, 1 })
            {
                Part(PrimitiveType.Cylinder, o + new Vector3(-hx - 1, 8, s * (gate + 3.5f)), new Vector3(7, 8, 7), brick);
                Part(PrimitiveType.Sphere, o + new Vector3(-hx - 1, 17, s * (gate + 3.5f)), new Vector3(4, 3, 4), marble, collider: false);
            }
            Part(PrimitiveType.Cube, o + new Vector3(-hx, 13.5f, 0), new Vector3(4, 3, gate * 2 + 2), brick);
            // corner towers
            foreach (var c in new[] { new Vector3(hx, 0, hz), new Vector3(hx, 0, -hz), new Vector3(-hx, 0, hz), new Vector3(-hx, 0, -hz) })
            {
                Part(PrimitiveType.Cylinder, o + c + Vector3.up * 8, new Vector3(9, 8, 9), brick);
                Part(PrimitiveType.Cylinder, o + c + Vector3.up * 17, new Vector3(4, 1.5f, 4), marble, collider: false);
                Part(PrimitiveType.Sphere, o + c + Vector3.up * 19, new Vector3(4, 3, 4), marble, collider: false);
            }
            // inner garden and marble pavilion (Sheesh Mahal style)
            Part(PrimitiveType.Cube, o + new Vector3(-8, 0.2f, 0), new Vector3(36, 0.2f, 30), new Color(0.35f, 0.55f, 0.3f), collider: false);
            Part(PrimitiveType.Cube, o + new Vector3(28, 5, 10), new Vector3(20, 10, 28), marble);
            for (int i = -1; i <= 1; i++)
                Part(PrimitiveType.Sphere, o + new Vector3(28, 11, 10 + i * 8), new Vector3(5, 4.5f, 5), marble, collider: false);
            Part(PrimitiveType.Cube, o + new Vector3(18, 7, -22), new Vector3(26, 14, 14), brick * 1.05f);
            return 20;
        }

        /// <summary>Minar-e-Pakistan: star-shaped base platform and a 60 m tapering tower with balconies.</summary>
        static float Minar(Vector3 o)
        {
            var stone = new Color(0.9f, 0.89f, 0.85f);
            Part(PrimitiveType.Cylinder, o + Vector3.up * 0.15f, new Vector3(30, 0.15f, 30), new Color(0.82f, 0.78f, 0.7f), collider: false);
            for (int i = 0; i < 5; i++) // five-pointed star platform suggestion
            {
                float a = i * 72f;
                var arm = Part(PrimitiveType.Cube, o + Vector3.up * 1.5f, new Vector3(5, 3, 26), stone * 0.97f);
                arm.transform.rotation = Quaternion.Euler(0, a, 0);
            }
            Part(PrimitiveType.Cylinder, o + Vector3.up * 3, new Vector3(13, 3, 13), stone);
            float y = 6;
            const int segments = 10;
            for (int i = 0; i < segments; i++)
            {
                float t = i / (float)(segments - 1);
                float r = Mathf.Lerp(8.5f, 4.2f, t);
                float h = 5.2f;
                Part(PrimitiveType.Cylinder, o + Vector3.up * (y + h / 2), new Vector3(r, h / 2, r), stone, collider: i < 2);
                y += h;
                if (i == 3 || i == 7)
                    Part(PrimitiveType.Cylinder, o + Vector3.up * y, new Vector3(r + 2.2f, 0.35f, r + 2.2f), stone * 0.92f, collider: false);
            }
            Part(PrimitiveType.Sphere, o + Vector3.up * (y + 1.6f), new Vector3(5, 4.5f, 5), stone, collider: false);
            Part(PrimitiveType.Cylinder, o + Vector3.up * (y + 4.5f), new Vector3(0.3f, 1.5f, 0.3f), new Color(0.75f, 0.75f, 0.78f), collider: false);
            return y + 6;
        }

        /// <summary>Bazaar: a lane lined with colourful stalls, awnings and shopfronts, with gateways at both ends.</summary>
        static float Bazaar(Vector3 o)
        {
            var wood = new Color(0.45f, 0.3f, 0.2f);
            Part(PrimitiveType.Cube, o + Vector3.up * 0.1f, new Vector3(10, 0.08f, 60), new Color(0.55f, 0.5f, 0.45f), collider: false);
            for (float z = -26; z <= 26; z += 6.5f)
                foreach (int side in new[] { -1, 1 })
                {
                    var p = o + new Vector3(side * 7, 0, z);
                    Part(PrimitiveType.Cube, p + Vector3.up * 0.5f, new Vector3(3, 1, 5), wood);
                    Part(PrimitiveType.Cube, p + new Vector3(side * 1.6f, 1.8f, 0), new Vector3(0.3f, 3.6f, 5.5f), wood * 0.9f);
                    var awningColor = Color.HSVToRGB((float)rng.NextDouble(), 0.75f, 0.9f);
                    var awning = Part(PrimitiveType.Cube, p + new Vector3(-side * 0.3f, 3.4f, 0), new Vector3(4.2f, 0.15f, 5.6f), awningColor, collider: false);
                    awning.transform.rotation = Quaternion.Euler(0, 0, side * 14f);
                    for (int g = 0; g < 4; g++)
                    {
                        var goods = Color.HSVToRGB((float)rng.NextDouble(), 0.6f, 0.95f);
                        Part(PrimitiveType.Cube, p + new Vector3(Rand(-0.8f, 0.8f), 1.25f, Rand(-1.8f, 1.8f)), Vector3.one * Rand(0.35f, 0.7f), goods, collider: false);
                    }
                    var shop = Color.HSVToRGB((float)rng.NextDouble() * 0.12f + 0.03f, 0.35f, Rand(0.6f, 0.85f));
                    Part(PrimitiveType.Cube, p + new Vector3(side * 6, 4, 0), new Vector3(8, 8, 6.4f), shop);
                }
            foreach (int end in new[] { -1, 1 })
            {
                var g = o + new Vector3(0, 0, end * 31);
                Part(PrimitiveType.Cube, g + new Vector3(-5.5f, 3.5f, 0), new Vector3(1.2f, 7, 1.2f), new Color(0.75f, 0.35f, 0.25f));
                Part(PrimitiveType.Cube, g + new Vector3(5.5f, 3.5f, 0), new Vector3(1.2f, 7, 1.2f), new Color(0.75f, 0.35f, 0.25f));
                Part(PrimitiveType.Cube, g + new Vector3(0, 7.5f, 0), new Vector3(12.4f, 1.6f, 1.2f), new Color(0.95f, 0.75f, 0.2f), collider: false);
            }
            return 9;
        }

        static float Generic(Vector3 o)
        {
            Part(PrimitiveType.Cylinder, o + Vector3.up * 5, new Vector3(4, 5, 4), new Color(0.85f, 0.85f, 0.8f));
            return 10;
        }

        // ---------------- helpers ----------------

        static GameObject Part(PrimitiveType type, Vector3 pos, Vector3 scale, Color color, bool collider = true)
        {
            var go = GameObject.CreatePrimitive(type);
            go.transform.SetParent(staticRoot, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = Mats.Get(color);
            if (!collider) Object.Destroy(go.GetComponent<Collider>());
            else if (type == PrimitiveType.Cylinder)
            {
                // CreatePrimitive gives cylinders a capsule collider; a box fits the flat tops better
                Object.Destroy(go.GetComponent<Collider>());
                go.AddComponent<BoxCollider>();
            }
            return go;
        }

        static float Rand(float min, float max) => min + (float)rng.NextDouble() * (max - min);
        static Color Pick(List<Color> list) => list[rng.Next(list.Count)];
    }
}
