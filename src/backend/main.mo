import Array "mo:core/Array";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import MixinAuthorization "authorization/MixinAuthorization";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";

actor {
  type UserStats = {
    wins : Nat;
    losses : Nat;
    draws : Nat;
  };

  module UserStats {
    public func compare(a : (Principal, UserStats), b : (Principal, UserStats)) : Order.Order {
      switch (Nat.compare(b.1.wins, a.1.wins)) {
        case (#equal) { Principal.compare(b.0, a.0) };
        case (order) { order };
      };
    };
  };

  type MatchResult = {
    winner : Principal;
    loser : Principal;
    rounds : Nat;
    timestamp : Time.Time;
  };

  public type UserProfile = {
    name : Text;
  };

  let userStats = Map.empty<Principal, UserStats>();
  let matchResults = Map.empty<Nat, MatchResult>();
  var nextMatchId = 0;
  let userProfiles = Map.empty<Principal, UserProfile>();

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile Management (required by instructions)
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Stats Query Functions
  public query ({ caller }) func getMyStats() : async UserStats {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access their stats");
    };
    switch (userStats.get(caller)) {
      case (null) { { wins = 0; losses = 0; draws = 0 } };
      case (?stats) { stats };
    };
  };

  // Public leaderboard - anyone can view (including guests)
  public query func getLeaderboard() : async [(Principal, UserStats)] {
    let allStats = userStats.toArray();
    let sorted = allStats.sort();
    let top10 = sorted.sliceToArray(0, Nat.min(10, sorted.size()));
    top10;
  };

  // Match Recording - FIXED: Only the winner can record their own win
  // This prevents users from fraudulently recording wins for themselves
  public shared ({ caller }) func recordMatch(loser : Principal, rounds : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can record matches");
    };

    // Caller must be recording their own win
    let winner = caller;

    // Prevent self-matches
    if (winner == loser) {
      Runtime.trap("Invalid match: Cannot play against yourself");
    };

    let matchResult : MatchResult = {
      winner;
      loser;
      rounds;
      timestamp = Time.now();
    };

    matchResults.add(nextMatchId, matchResult);
    nextMatchId += 1;

    // Update winner stats
    let winnerStats = switch (userStats.get(winner)) {
      case (null) { { wins = 1; losses = 0; draws = 0 } };
      case (?stats) {
        {
          wins = stats.wins + 1;
          losses = stats.losses;
          draws = stats.draws;
        };
      };
    };
    userStats.add(winner, winnerStats);

    // Update loser stats
    let loserStats = switch (userStats.get(loser)) {
      case (null) { { wins = 0; losses = 1; draws = 0 } };
      case (?stats) {
        {
          wins = stats.wins;
          losses = stats.losses + 1;
          draws = stats.draws;
        };
      };
    };
    userStats.add(loser, loserStats);
  };

  // Draw Recording - FIXED: Only one of the participants can record
  public shared ({ caller }) func recordDraw(opponent : Principal) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can record matches");
    };

    // Caller must be one of the participants
    let player1 = caller;
    let player2 = opponent;

    // Prevent self-matches
    if (player1 == player2) {
      Runtime.trap("Invalid match: Cannot play against yourself");
    };

    // Update both players' records
    let player1Stats = switch (userStats.get(player1)) {
      case (null) { { wins = 0; losses = 0; draws = 1 } };
      case (?stats) {
        {
          wins = stats.wins;
          losses = stats.losses;
          draws = stats.draws + 1;
        };
      };
    };
    userStats.add(player1, player1Stats);

    let player2Stats = switch (userStats.get(player2)) {
      case (null) { { wins = 0; losses = 0; draws = 1 } };
      case (?stats) {
        {
          wins = stats.wins;
          losses = stats.losses;
          draws = stats.draws + 1;
        };
      };
    };
    userStats.add(player2, player2Stats);
  };

  // Admin-only: Record match between any two players (for corrections/admin purposes)
  public shared ({ caller }) func adminRecordMatch(winner : Principal, loser : Principal, rounds : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };

    if (winner == loser) {
      Runtime.trap("Invalid match: Cannot play against yourself");
    };

    let matchResult : MatchResult = {
      winner;
      loser;
      rounds;
      timestamp = Time.now();
    };

    matchResults.add(nextMatchId, matchResult);
    nextMatchId += 1;

    // Update winner stats
    let winnerStats = switch (userStats.get(winner)) {
      case (null) { { wins = 1; losses = 0; draws = 0 } };
      case (?stats) {
        {
          wins = stats.wins + 1;
          losses = stats.losses;
          draws = stats.draws;
        };
      };
    };
    userStats.add(winner, winnerStats);

    // Update loser stats
    let loserStats = switch (userStats.get(loser)) {
      case (null) { { wins = 0; losses = 1; draws = 0 } };
      case (?stats) {
        {
          wins = stats.wins;
          losses = stats.losses + 1;
          draws = stats.draws;
        };
      };
    };
    userStats.add(loser, loserStats);
  };

  // Admin-only: Reset a player's stats
  public shared ({ caller }) func adminResetStats(player : Principal) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };

    userStats.add(player, { wins = 0; losses = 0; draws = 0 });
  };

  // Admin-only: Set specific stats for a player
  public shared ({ caller }) func adminSetStats(player : Principal, stats : UserStats) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };

    userStats.add(player, stats);
  };
};
