using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using WorldTour.Core;

namespace WorldTour
{
    public enum GameScreen { MainMenu, WorldMap, Flight, Arrival, Explore, Pause, Profile, Settings }

    /// <summary>
    /// Owns the game state (data, profile, current screen, loaded city) and
    /// routes IMGUI drawing to the active screen.
    /// </summary>
    public sealed class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        public WorldDatabase Db { get; private set; }
        public PlayerProfile Profile { get; private set; }
        public TravelService Travel { get; private set; }
        public GameScreen Screen { get; private set; } = GameScreen.MainMenu;
        public readonly Toasts Toasts = new Toasts();

        public Camera MainCamera { get; private set; }
        public CityEnvironment City { get; private set; }
        public PlayerController Player { get; private set; }
        public ThirdPersonCamera CameraRig { get; private set; }

        Texture2D mapTexture;
        WorldMapScreen mapScreen;
        FlightScreen flightScreen;
        ExploreHud exploreHud;
        MenuScreens menus;
        GameScreen settingsReturn = GameScreen.MainMenu;
        string loadError;

        public ArrivalResult LastArrival { get; private set; }

        void Awake()
        {
            Instance = this;
            Application.targetFrameRate = 60;
            UnityEngine.Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Settings.Load();
            SetupCamera();
            try
            {
                Db = LoadDatabase();
            }
            catch (System.Exception e)
            {
                loadError = e.Message;
                Debug.LogError("WorldTour: failed to load data: " + e);
            }
            mapScreen = new WorldMapScreen(this);
            flightScreen = new FlightScreen(this);
            exploreHud = new ExploreHud(this);
            menus = new MenuScreens(this);
        }

        static WorldDatabase LoadDatabase()
        {
            string Load(string name)
            {
                var asset = Resources.Load<TextAsset>("WorldTourData/" + name);
                if (asset == null) throw new System.IO.FileNotFoundException("Missing Resources/WorldTourData/" + name);
                return asset.text;
            }
            return WorldDatabase.FromJson(Load("countries"), Load("airports"), Load("destinations"), Load("economy"));
        }

        void SetupCamera()
        {
            MainCamera = Camera.main;
            if (MainCamera == null)
            {
                var go = new GameObject("Main Camera") { tag = "MainCamera" };
                MainCamera = go.AddComponent<Camera>();
                go.AddComponent<AudioListener>();
            }
            MainCamera.clearFlags = CameraClearFlags.SolidColor;
            MainCamera.backgroundColor = new Color(0.08f, 0.12f, 0.18f);
            MainCamera.cullingMask = 0; // nothing 3D until a city is loaded
            MainCamera.nearClipPlane = 0.2f;
            MainCamera.farClipPlane = 600f;
        }

        public Texture2D MapTexture
        {
            get
            {
                if (mapTexture == null)
                {
                    const int w = 2048, h = 1024;
                    var featured = new HashSet<string>(Db.Destinations.Select(d => d.CountryId));
                    var pixels = MapRasterizer.Render(Db, w, h, featured, bottomUp: true);
                    mapTexture = new Texture2D(w, h, TextureFormat.RGBA32, false)
                    {
                        wrapMode = TextureWrapMode.Clamp,
                        filterMode = FilterMode.Bilinear,
                        name = "WorldMap",
                    };
                    mapTexture.LoadRawTextureData(pixels);
                    mapTexture.Apply(false, true); // upload and free the CPU copy
                }
                return mapTexture;
            }
        }

        // ---------------- state changes ----------------

        public void NewGame()
        {
            SetProfile(PlayerProfile.CreateNew(Db.Economy));
            SaveNow(false);
            UnloadCity();
            mapScreen.FocusCurrent();
            Toasts.Show($"Welcome! You start in {Travel.Current.Name} with {UiKit.Coins(Profile.Coins)}.", UiKit.Gold, 4f);
            Show(GameScreen.WorldMap);
        }

        public bool ContinueGame()
        {
            var p = SaveSystem.Load(Db);
            if (p == null) { Toasts.Show("Save file could not be loaded.", UiKit.Red); return false; }
            SetProfile(p);
            if (Profile.ActiveTicket != null) { flightScreen.Begin(Profile.ActiveTicket); Show(GameScreen.Flight); }
            else if (Travel.Current.IsExplorable) EnterCity(Travel.Current);
            else { mapScreen.FocusCurrent(); Show(GameScreen.WorldMap); }
            return true;
        }

        void SetProfile(PlayerProfile p)
        {
            Profile = p;
            Travel = new TravelService(Db, Profile);
        }

        public void Show(GameScreen s)
        {
            if (s == GameScreen.Settings && Screen != GameScreen.Settings) settingsReturn = Screen;
            Screen = s;
            bool exploring = s == GameScreen.Explore;
            if (Player != null) Player.InputEnabled = exploring;
            if (CameraRig != null) CameraRig.InputEnabled = exploring;
            // Render the 3D city only while it is visible behind the HUD or pause menu.
            bool show3D = City != null && (exploring || s == GameScreen.Pause || s == GameScreen.Profile || s == GameScreen.Settings);
            MainCamera.cullingMask = show3D ? ~0 : 0;
        }

        public void CloseSettings() => Show(settingsReturn);

        /// <summary>Back from pause/profile: to the city if one is loaded, otherwise the map.</summary>
        public void Resume() => Show(City != null ? GameScreen.Explore : GameScreen.WorldMap);

        public void OpenMap()
        {
            mapScreen.FocusCurrent();
            Show(GameScreen.WorldMap);
        }

        public void ToMainMenu()
        {
            SaveNow(false);
            UnloadCity();
            Show(GameScreen.MainMenu);
        }

        public void ResetProgress()
        {
            UnloadCity();
            Profile = null;
            Travel = null;
            SaveSystem.Delete();
            Toasts.Show("Progress deleted.", UiKit.Red);
            Show(GameScreen.MainMenu);
        }

        public void BookFlight(string destinationId)
        {
            var result = Travel.Book(destinationId);
            if (!result.Success)
            {
                Toasts.Show(result.Message, UiKit.Red, 4f);
                return;
            }
            SaveNow(false);
            Toasts.Show($"-{result.Ticket.Price} coins  |  Ticket {result.Ticket.BookingRef}", UiKit.Gold);
            UnloadCity();
            flightScreen.Begin(result.Ticket);
            Show(GameScreen.Flight);
        }

        public void LandFlight()
        {
            LastArrival = Travel.CompleteFlight();
            SaveNow(false);
            Show(GameScreen.Arrival);
        }

        public void EnterCity(Destination d)
        {
            if (City != null && City.Destination == d) { Show(GameScreen.Explore); return; }
            UnloadCity();
            City = CityBuilder.Build(d);
            var spawn = City.SpawnPoint;
            Player = PlayerController.Create(spawn, City.SpawnFacing);
            CameraRig = ThirdPersonCamera.Attach(MainCamera, Player.transform);
            exploreHud.Reset();
            Show(GameScreen.Explore);
        }

        public void UnloadCity()
        {
            if (CameraRig != null) { CameraRig.Detach(); CameraRig = null; }
            if (Player != null) { Destroy(Player.gameObject); Player = null; }
            if (City != null) { City.Unload(); City = null; }
            RenderSettings.fog = false;
            MainCamera.clearFlags = CameraClearFlags.SolidColor;
            MainCamera.backgroundColor = new Color(0.08f, 0.12f, 0.18f);
        }

        public void VisitLandmark(LandmarkInfo landmark)
        {
            var r = Travel.VisitLandmark(landmark.Spec);
            if (r.FirstVisit)
            {
                Toasts.Show($"Visited {landmark.Spec.Name}!  +{r.Reward} coins", UiKit.Green, 4f);
                landmark.MarkVisited();
                SaveNow(false);
            }
        }

        public void SaveNow(bool announce)
        {
            if (Profile == null) return;
            bool ok = SaveSystem.Save(Profile);
            if (announce) Toasts.Show(ok ? "Game saved." : "Save failed!", ok ? UiKit.Green : UiKit.Red);
        }

        // ---------------- Unity callbacks ----------------

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape)) HandleBack(); // also the Android back button
            if (Screen == GameScreen.WorldMap) mapScreen.Update();
            if (Screen == GameScreen.Flight) flightScreen.Update();
            if (Screen == GameScreen.Explore) exploreHud.Update();
        }

        void HandleBack()
        {
            switch (Screen)
            {
                case GameScreen.Explore: Show(GameScreen.Pause); break;
                case GameScreen.Pause: Resume(); break;
                case GameScreen.Profile: Resume(); break;
                case GameScreen.Settings: CloseSettings(); break;
                case GameScreen.WorldMap:
                    if (!mapScreen.HandleBack()) { if (City != null) Show(GameScreen.Explore); else Show(GameScreen.Pause); }
                    break;
            }
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) SaveNow(false);
        }

        void OnApplicationQuit() => SaveNow(false);

        void OnGUI()
        {
            UiKit.Begin();
            if (loadError != null)
            {
                GUI.Label(UiKit.R(20, 20, UiKit.VW - 40, 200), "<b>Game data failed to load:</b>\n" + loadError, UiKit.Label);
                return;
            }
            switch (Screen)
            {
                case GameScreen.MainMenu: menus.DrawMainMenu(); break;
                case GameScreen.WorldMap: mapScreen.Draw(); break;
                case GameScreen.Flight: flightScreen.Draw(); break;
                case GameScreen.Arrival: menus.DrawArrival(); break;
                case GameScreen.Explore: exploreHud.Draw(); break;
                case GameScreen.Pause: menus.DrawPause(); break;
                case GameScreen.Profile: menus.DrawProfile(); break;
                case GameScreen.Settings: menus.DrawSettings(); break;
            }
            Toasts.Draw();
        }
    }
}
