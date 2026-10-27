using System;
using System.Collections.Generic;
using System.Globalization;

namespace WorldTour.Core
{
    public enum TransactionCategory { Flight, Reward, Hotel, Food, Transport, Shopping, Other }

    public sealed class Transaction
    {
        public DateTime TimeUtc;
        public int Amount; // negative = spent, positive = earned
        public TransactionCategory Category;
        public string Description;
        public int BalanceAfter;
    }

    /// <summary>A purchased ticket for a flight that has not landed yet.</summary>
    public sealed class Ticket
    {
        public string BookingRef;
        public string FromDestinationId;
        public string ToDestinationId;
        public string FromAirport;
        public string ToAirport;
        public int Price;
        public double DistanceKm;
    }

    public sealed class PlayerProfile
    {
        public const int MaxHistory = 200;
        public const int SaveVersion = 1;

        public string PlayerName = "Traveller";
        public int Coins;
        public string CurrentDestinationId;
        public readonly HashSet<string> VisitedDestinations = new HashSet<string>();
        public readonly HashSet<string> VisitedLandmarks = new HashSet<string>();
        public readonly List<Transaction> History = new List<Transaction>();
        public int FlightsTaken;
        public long TotalSpent;
        public long TotalEarned;
        public Ticket ActiveTicket;

        public event Action<Transaction> TransactionAdded;

        public static PlayerProfile CreateNew(EconomyConfig economy)
        {
            var p = new PlayerProfile { Coins = economy.StartingCoins, CurrentDestinationId = economy.StartingDestination };
            p.VisitedDestinations.Add(economy.StartingDestination);
            return p;
        }

        public bool CanAfford(int amount) => amount <= Coins;

        public int Shortfall(int amount) => Math.Max(0, amount - Coins);

        /// <summary>Deducts coins if affordable. Returns false and changes nothing otherwise.</summary>
        public bool TrySpend(int amount, TransactionCategory category, string description)
        {
            if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
            if (!CanAfford(amount)) return false;
            Coins -= amount;
            TotalSpent += amount;
            Record(-amount, category, description);
            return true;
        }

        public void Earn(int amount, TransactionCategory category, string description)
        {
            if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
            Coins += amount;
            TotalEarned += amount;
            Record(amount, category, description);
        }

        void Record(int amount, TransactionCategory category, string description)
        {
            var t = new Transaction { TimeUtc = DateTime.UtcNow, Amount = amount, Category = category, Description = description, BalanceAfter = Coins };
            History.Add(t);
            if (History.Count > MaxHistory) History.RemoveAt(0);
            TransactionAdded?.Invoke(t);
        }

        // ---------- Save / load ----------

        public string ToJson()
        {
            var history = new List<object>();
            foreach (var t in History)
            {
                history.Add(new Dictionary<string, object>
                {
                    ["t"] = t.TimeUtc.ToString("o", CultureInfo.InvariantCulture),
                    ["a"] = t.Amount,
                    ["c"] = t.Category.ToString(),
                    ["d"] = t.Description,
                    ["b"] = t.BalanceAfter,
                });
            }
            var root = new Dictionary<string, object>
            {
                ["version"] = SaveVersion,
                ["name"] = PlayerName,
                ["coins"] = Coins,
                ["current"] = CurrentDestinationId,
                ["visitedDestinations"] = new List<object>(VisitedDestinations),
                ["visitedLandmarks"] = new List<object>(VisitedLandmarks),
                ["flights"] = FlightsTaken,
                ["spent"] = TotalSpent,
                ["earned"] = TotalEarned,
                ["history"] = history,
            };
            if (ActiveTicket != null)
            {
                root["ticket"] = new Dictionary<string, object>
                {
                    ["ref"] = ActiveTicket.BookingRef,
                    ["from"] = ActiveTicket.FromDestinationId,
                    ["to"] = ActiveTicket.ToDestinationId,
                    ["fromAirport"] = ActiveTicket.FromAirport,
                    ["toAirport"] = ActiveTicket.ToAirport,
                    ["price"] = ActiveTicket.Price,
                    ["km"] = ActiveTicket.DistanceKm,
                };
            }
            return Json.Write(root);
        }

        /// <summary>Restores a profile, ignoring references to destinations that no longer exist.</summary>
        public static PlayerProfile FromJson(string json, WorldDatabase db)
        {
            var o = (Dictionary<string, object>)Json.Parse(json);
            int version = o.Int("version", 0);
            if (version < 1 || version > SaveVersion) throw new FormatException("Unsupported save version " + version);

            var p = new PlayerProfile
            {
                PlayerName = o.Str("name", "Traveller"),
                Coins = Math.Max(0, o.Int("coins")),
                CurrentDestinationId = o.Str("current"),
                FlightsTaken = o.Int("flights"),
                TotalSpent = (long)o.Num("spent"),
                TotalEarned = (long)o.Num("earned"),
            };
            if (db.GetDestination(p.CurrentDestinationId) == null) p.CurrentDestinationId = db.Economy.StartingDestination;
            foreach (var v in o.Arr("visitedDestinations")) if (v is string s) p.VisitedDestinations.Add(s);
            foreach (var v in o.Arr("visitedLandmarks")) if (v is string s) p.VisitedLandmarks.Add(s);
            foreach (Dictionary<string, object> h in o.Arr("history"))
            {
                Enum.TryParse(h.Str("c", "Other"), out TransactionCategory cat);
                DateTime.TryParse(h.Str("t"), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var time);
                p.History.Add(new Transaction { TimeUtc = time, Amount = h.Int("a"), Category = cat, Description = h.Str("d", ""), BalanceAfter = h.Int("b") });
            }
            var t = o.Obj("ticket");
            if (t != null && db.GetDestination(t.Str("to")) != null)
            {
                p.ActiveTicket = new Ticket
                {
                    BookingRef = t.Str("ref"),
                    FromDestinationId = t.Str("from"),
                    ToDestinationId = t.Str("to"),
                    FromAirport = t.Str("fromAirport"),
                    ToAirport = t.Str("toAirport"),
                    Price = t.Int("price"),
                    DistanceKm = t.Num("km"),
                };
            }
            return p;
        }
    }
}
