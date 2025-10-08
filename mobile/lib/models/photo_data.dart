import 'player.dart';

class PhotoData {
  final String photoUrl;
  final int photoIndex;
  final int totalPhotos;
  final List<Player> players;

  PhotoData({
    required this.photoUrl,
    required this.photoIndex,
    required this.totalPhotos,
    required this.players,
  });

  factory PhotoData.fromJson(Map<String, dynamic> json) {
    return PhotoData(
      photoUrl: json['photoUrl'] as String,
      photoIndex: json['photoIndex'] as int,
      totalPhotos: json['totalPhotos'] as int,
      players: (json['players'] as List<dynamic>)
          .map((p) => Player.fromJson(p as Map<String, dynamic>))
          .toList(),
    );
  }
}
