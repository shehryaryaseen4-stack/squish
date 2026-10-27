using System;
using System.Collections.Generic;

namespace WorldTour.Core
{
    public sealed class FlightQuote
    {
        public Destination From, To;
        public Airport FromAirport, ToAirport;
        public double DistanceKm;
        public int Price;
        public bool International;
        /// <summary>True if a route exists and the destination can be travelled to (ignores coins).</summary>
        public bool Available;
        /// <summary>Why the flight is unavailable, or null.</summary>
        public string UnavailableReason;
        public int Shortfall;
        public bool CanBook => Available && Shortfall == 0;
    }

    public sealed class BookingResult
    {
        public bool Success;
        public string Message;
        public int Shortfall;
        public Ticket Ticket;
    }

    public sealed class ArrivalResult
    {
        public Destination Destination;
        public bool FirstVisit;
        public int Reward;
    }

    public sealed class LandmarkVisitResult
    {
        public bool FirstVisit;
        public int Reward;
    }

    /// <summary>Flight network, fares, booking and arrival rules. No presentation code.</summary>
    public sealed class TravelService
    {
        readonly WorldDatabase db;
        readonly PlayerProfile profile;
        readonly Random random = new Random();

        public TravelService(WorldDatabase db, PlayerProfile profile)
        {
            this.db = db;
            this.profile = profile;
        }

        public Destination Current => db.GetDestination(profile.CurrentDestinationId);

        /// <summary>
        /// International airports connect to each other worldwide. Regional
        /// airports only connect to international airports in the same country.
        /// </summary>
        public static bool HasRoute(Airport a, Airport b)
        {
            if (a == null || b == null || a.Code == b.Code) return false;
            if (a.Type == AirportType.Regional || b.Type == AirportType.Regional)
                return a.CountryId == b.CountryId && !(a.Type == AirportType.Regional && b.Type == AirportType.Regional);
            return true;
        }

        public int Fare(Airport from, Airport to, double distanceKm)
        {
            var e = db.Economy;
            double fare = e.BaseFare + e.PerKm * distanceKm;
            if (from.CountryId != to.CountryId) fare += e.InternationalSurcharge;
            if (from.Type == AirportType.Regional || to.Type == AirportType.Regional) fare += e.RegionalSurcharge;
            return (int)Math.Round(Math.Max(e.MinimumFare, fare));
        }

        public FlightQuote Quote(string toDestinationId)
        {
            var from = Current;
            var to = db.GetDestination(toDestinationId);
            if (to == null) throw new ArgumentException("Unknown destination " + toDestinationId);
            var q = new FlightQuote
            {
                From = from,
                To = to,
                FromAirport = db.GetAirport(from.AirportCode),
                ToAirport = db.GetAirport(to.AirportCode),
            };
            q.International = q.FromAirport.CountryId != q.ToAirport.CountryId;
            q.DistanceKm = GeoMath.DistanceKm(q.FromAirport.Lat, q.FromAirport.Lon, q.ToAirport.Lat, q.ToAirport.Lon);
            q.Price = Fare(q.FromAirport, q.ToAirport, q.DistanceKm);

            if (to.Id == from.Id) q.UnavailableReason = "You are already here.";
            else if (q.FromAirport.Code == q.ToAirport.Code) q.UnavailableReason = "Same airport - ground travel is not implemented yet.";
            else if (!HasRoute(q.FromAirport, q.ToAirport)) q.UnavailableReason = $"No direct route {q.FromAirport.Code} - {q.ToAirport.Code}. Regional airports only connect to domestic hubs.";
            else if (!to.IsExplorable) q.UnavailableReason = "The 3D area for this destination has not been built yet.";
            q.Available = q.UnavailableReason == null;
            q.Shortfall = profile.Shortfall(q.Price);
            return q;
        }

        public BookingResult Book(string toDestinationId)
        {
            if (profile.ActiveTicket != null)
                return new BookingResult { Message = "You already have a flight in progress." };
            var q = Quote(toDestinationId);
            if (!q.Available) return new BookingResult { Message = q.UnavailableReason };
            if (q.Shortfall > 0)
                return new BookingResult { Shortfall = q.Shortfall, Message = $"Not enough coins: you need {q.Shortfall} more." };

            string desc = $"Flight {q.FromAirport.Code} -> {q.ToAirport.Code} ({q.To.Name})";
            if (!profile.TrySpend(q.Price, TransactionCategory.Flight, desc))
                return new BookingResult { Shortfall = profile.Shortfall(q.Price), Message = "Payment failed." };

            var ticket = new Ticket
            {
                BookingRef = "WT" + random.Next(100000, 999999),
                FromDestinationId = q.From.Id,
                ToDestinationId = q.To.Id,
                FromAirport = q.FromAirport.Code,
                ToAirport = q.ToAirport.Code,
                Price = q.Price,
                DistanceKm = q.DistanceKm,
            };
            profile.ActiveTicket = ticket;
            return new BookingResult { Success = true, Ticket = ticket, Message = $"Booked! {q.Price} coins paid." };
        }

        /// <summary>Lands the active flight: moves the player and pays the first-visit reward.</summary>
        public ArrivalResult CompleteFlight()
        {
            var ticket = profile.ActiveTicket ?? throw new InvalidOperationException("No active flight");
            var dest = db.GetDestination(ticket.ToDestinationId);
            profile.ActiveTicket = null;
            profile.CurrentDestinationId = dest.Id;
            profile.FlightsTaken++;
            var result = new ArrivalResult { Destination = dest, FirstVisit = profile.VisitedDestinations.Add(dest.Id) };
            if (result.FirstVisit)
            {
                result.Reward = db.Economy.FirstVisitReward;
                profile.Earn(result.Reward, TransactionCategory.Reward, "First visit: " + dest.Name);
            }
            return result;
        }

        public LandmarkVisitResult VisitLandmark(LandmarkSpec landmark)
        {
            var r = new LandmarkVisitResult { FirstVisit = profile.VisitedLandmarks.Add(landmark.Id) };
            if (r.FirstVisit)
            {
                r.Reward = db.Economy.LandmarkReward;
                profile.Earn(r.Reward, TransactionCategory.Reward, "Sightseeing: " + landmark.Name);
            }
            return r;
        }

        /// <summary>Legitimate in-game ways to earn coins, shown when the player is short.</summary>
        public List<string> EarningSuggestions()
        {
            var list = new List<string>();
            var here = Current;
            if (here?.Environment != null)
                foreach (var l in here.Environment.Landmarks)
                    if (!profile.VisitedLandmarks.Contains(l.Id))
                        list.Add($"Visit {l.Name} here in {here.Name} (+{db.Economy.LandmarkReward})");
            foreach (var d in db.Destinations)
                if (d.IsExplorable && !profile.VisitedDestinations.Contains(d.Id))
                    list.Add($"First visit to {d.Name} (+{db.Economy.FirstVisitReward})");
            if (list.Count == 0) list.Add("More ways to earn (daily challenges, missions) arrive in a later update.");
            return list;
        }
    }
}
