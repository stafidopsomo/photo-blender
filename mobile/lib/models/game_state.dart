import 'player.dart';

enum GameStatus { waiting, uploading, playing, finished }

class GameState {
  final String roomCode;
  final String playerId;
  final String playerName;
  final bool isHost;
  final GameStatus status;
  final List<Player> players;
  final int totalPhotos;
  final bool canStartGame;

  GameState({
    required this.roomCode,
    required this.playerId,
    required this.playerName,
    required this.isHost,
    this.status = GameStatus.waiting,
    this.players = const [],
    this.totalPhotos = 0,
    this.canStartGame = false,
  });

  factory GameState.fromJson(Map<String, dynamic> json, String roomCode, String playerId, String playerName, bool isHost) {
    GameStatus status = GameStatus.waiting;
    final gameStateStr = json['gameState'] as String?;

    if (gameStateStr != null) {
      switch (gameStateStr) {
        case 'waiting':
          status = GameStatus.waiting;
          break;
        case 'uploading':
          status = GameStatus.uploading;
          break;
        case 'playing':
          status = GameStatus.playing;
          break;
        case 'finished':
          status = GameStatus.finished;
          break;
      }
    }

    return GameState(
      roomCode: roomCode,
      playerId: playerId,
      playerName: playerName,
      isHost: isHost,
      status: status,
      players: (json['players'] as List<dynamic>?)
              ?.map((p) => Player.fromJson(p as Map<String, dynamic>))
              .toList() ??
          [],
      totalPhotos: json['totalPhotos'] as int? ?? 0,
      canStartGame: json['canStartGame'] as bool? ?? false,
    );
  }

  GameState copyWith({
    String? roomCode,
    String? playerId,
    String? playerName,
    bool? isHost,
    GameStatus? status,
    List<Player>? players,
    int? totalPhotos,
    bool? canStartGame,
  }) {
    return GameState(
      roomCode: roomCode ?? this.roomCode,
      playerId: playerId ?? this.playerId,
      playerName: playerName ?? this.playerName,
      isHost: isHost ?? this.isHost,
      status: status ?? this.status,
      players: players ?? this.players,
      totalPhotos: totalPhotos ?? this.totalPhotos,
      canStartGame: canStartGame ?? this.canStartGame,
    );
  }
}
