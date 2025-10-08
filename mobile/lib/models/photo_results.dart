class LeaderboardEntry {
  final String name;
  final int score;
  final int streak;

  LeaderboardEntry({
    required this.name,
    required this.score,
    this.streak = 0,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return LeaderboardEntry(
      name: json['name'] as String,
      score: json['score'] as int,
      streak: json['streak'] as int? ?? 0,
    );
  }
}

class GuessResult {
  final String guesser;
  final String guessed;
  final bool correct;
  final double? timeToAnswer;

  GuessResult({
    required this.guesser,
    required this.guessed,
    required this.correct,
    this.timeToAnswer,
  });

  factory GuessResult.fromJson(Map<String, dynamic> json) {
    return GuessResult(
      guesser: json['guesser'] as String,
      guessed: json['guessed'] as String,
      correct: json['correct'] as bool,
      timeToAnswer: json['timeToAnswer'] as double?,
    );
  }
}

class PhotoResults {
  final String correctPlayer;
  final String correctPlayerId;
  final List<GuessResult> guesses;
  final List<LeaderboardEntry> leaderboard;

  PhotoResults({
    required this.correctPlayer,
    required this.correctPlayerId,
    required this.guesses,
    required this.leaderboard,
  });

  factory PhotoResults.fromJson(Map<String, dynamic> json) {
    return PhotoResults(
      correctPlayer: json['correctPlayer'] as String,
      correctPlayerId: json['correctPlayerId'] as String,
      guesses: (json['guesses'] as List<dynamic>)
          .map((g) => GuessResult.fromJson(g as Map<String, dynamic>))
          .toList(),
      leaderboard: (json['leaderboard'] as List<dynamic>)
          .map((l) => LeaderboardEntry.fromJson(l as Map<String, dynamic>))
          .toList(),
    );
  }
}
