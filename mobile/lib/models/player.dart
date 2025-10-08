class Player {
  final String id;
  final String name;
  final int photosUploaded;
  final int score;
  final int streak;
  final bool isHost;

  Player({
    required this.id,
    required this.name,
    this.photosUploaded = 0,
    this.score = 0,
    this.streak = 0,
    this.isHost = false,
  });

  factory Player.fromJson(Map<String, dynamic> json) {
    return Player(
      id: json['id'] as String,
      name: json['name'] as String,
      photosUploaded: json['photosUploaded'] as int? ?? 0,
      score: json['score'] as int? ?? 0,
      streak: json['streak'] as int? ?? 0,
      isHost: json['isHost'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'photosUploaded': photosUploaded,
      'score': score,
      'streak': streak,
      'isHost': isHost,
    };
  }

  Player copyWith({
    String? id,
    String? name,
    int? photosUploaded,
    int? score,
    int? streak,
    bool? isHost,
  }) {
    return Player(
      id: id ?? this.id,
      name: name ?? this.name,
      photosUploaded: photosUploaded ?? this.photosUploaded,
      score: score ?? this.score,
      streak: streak ?? this.streak,
      isHost: isHost ?? this.isHost,
    );
  }
}
