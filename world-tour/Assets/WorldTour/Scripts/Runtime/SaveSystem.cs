using System;
using System.IO;
using UnityEngine;
using WorldTour.Core;

namespace WorldTour
{
    /// <summary>Stores the player profile as JSON in Application.persistentDataPath.</summary>
    public static class SaveSystem
    {
        static string FilePath => Path.Combine(Application.persistentDataPath, "worldtour_save.json");

        public static bool HasSave => File.Exists(FilePath);

        public static bool Save(PlayerProfile profile)
        {
            try
            {
                string tmp = FilePath + ".tmp";
                File.WriteAllText(tmp, profile.ToJson());
                if (File.Exists(FilePath)) File.Delete(FilePath);
                File.Move(tmp, FilePath);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError("WorldTour: save failed: " + e);
                return false;
            }
        }

        /// <summary>Returns null if there is no save or it cannot be read (a corrupt file is kept as .bad).</summary>
        public static PlayerProfile Load(WorldDatabase db)
        {
            if (!HasSave) return null;
            try
            {
                return PlayerProfile.FromJson(File.ReadAllText(FilePath), db);
            }
            catch (Exception e)
            {
                Debug.LogError("WorldTour: could not read save, moving it aside: " + e);
                try { File.Copy(FilePath, FilePath + ".bad", true); } catch (Exception) { }
                return null;
            }
        }

        public static void Delete()
        {
            if (HasSave) File.Delete(FilePath);
        }
    }
}
