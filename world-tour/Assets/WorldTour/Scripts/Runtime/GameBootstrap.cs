using UnityEngine;

namespace WorldTour
{
    /// <summary>
    /// Starts the game in whatever scene is loaded first, so the project needs
    /// no hand-authored scene: an empty scene in Build Settings is enough.
    /// </summary>
    public static class GameBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Start()
        {
            if (GameManager.Instance != null) return;
            var go = new GameObject("WorldTour");
            Object.DontDestroyOnLoad(go);
            go.AddComponent<GameManager>();
        }
    }

    /// <summary>Player preferences that are not part of the save game.</summary>
    public static class Settings
    {
        public static float UiScale = 1f;
        public static float LookSensitivity = 1f;
        public static int Quality = -1;

        public static void Load()
        {
            UiScale = PlayerPrefs.GetFloat("wt_ui_scale", 1f);
            LookSensitivity = PlayerPrefs.GetFloat("wt_look", 1f);
            Quality = PlayerPrefs.GetInt("wt_quality", -1);
            Apply();
        }

        public static void Save()
        {
            PlayerPrefs.SetFloat("wt_ui_scale", UiScale);
            PlayerPrefs.SetFloat("wt_look", LookSensitivity);
            PlayerPrefs.SetInt("wt_quality", Quality);
            PlayerPrefs.Save();
            Apply();
        }

        static void Apply()
        {
            UiKit.UserScale = UiScale;
            if (Quality >= 0 && Quality < QualitySettings.names.Length) QualitySettings.SetQualityLevel(Quality, true);
            QualitySettings.shadowDistance = 70f; // keep shadows cheap on mobile
        }
    }
}
