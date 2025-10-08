import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'api_service.dart';

class SocketService {
  IO.Socket? socket;

  // Callbacks
  Function(Map<String, dynamic>)? onGameState;
  Function(String, int)? onPlayerJoined;
  Function(String, int)? onPlayerLeft;
  Function(String, int, bool)? onPhotoUploaded;
  Function(int, List<Map<String, dynamic>>)? onGameStarted;
  Function(Map<String, dynamic>)? onNewPhoto;
  Function(Map<String, dynamic>)? onPhotoResults;
  Function(List<Map<String, dynamic>>)? onGameFinished;

  void connect() {
    socket = IO.io(
      ApiService.baseUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    socket!.connect();

    socket!.onConnect((_) {
      print('Socket connected');
    });

    socket!.onDisconnect((_) {
      print('Socket disconnected');
    });

    socket!.on('gameState', (data) {
      if (onGameState != null) {
        onGameState!(data as Map<String, dynamic>);
      }
    });

    socket!.on('playerJoined', (data) {
      if (onPlayerJoined != null) {
        final playerData = data as Map<String, dynamic>;
        onPlayerJoined!(
          playerData['playerName'] as String,
          playerData['totalPlayers'] as int,
        );
      }
    });

    socket!.on('playerLeft', (data) {
      if (onPlayerLeft != null) {
        final playerData = data as Map<String, dynamic>;
        onPlayerLeft!(
          playerData['playerName'] as String,
          playerData['totalPlayers'] as int,
        );
      }
    });

    socket!.on('photoUploaded', (data) {
      if (onPhotoUploaded != null) {
        final photoData = data as Map<String, dynamic>;
        onPhotoUploaded!(
          photoData['playerName'] as String,
          photoData['totalPhotos'] as int,
          photoData['canStartGame'] as bool,
        );
      }
    });

    socket!.on('gameStarted', (data) {
      if (onGameStarted != null) {
        final gameData = data as Map<String, dynamic>;
        onGameStarted!(
          gameData['totalPhotos'] as int,
          (gameData['players'] as List<dynamic>)
              .map((p) => p as Map<String, dynamic>)
              .toList(),
        );
      }
    });

    socket!.on('newPhoto', (data) {
      if (onNewPhoto != null) {
        onNewPhoto!(data as Map<String, dynamic>);
      }
    });

    socket!.on('photoResults', (data) {
      if (onPhotoResults != null) {
        onPhotoResults!(data as Map<String, dynamic>);
      }
    });

    socket!.on('gameFinished', (data) {
      if (onGameFinished != null) {
        final finishData = data as Map<String, dynamic>;
        onGameFinished!(
          (finishData['leaderboard'] as List<dynamic>)
              .map((l) => l as Map<String, dynamic>)
              .toList(),
        );
      }
    });
  }

  void joinRoom(String roomCode, String playerId, String playerName, bool isHost) {
    socket?.emit('joinRoom', {
      'roomCode': roomCode.toUpperCase(),
      'playerId': playerId,
      'playerName': playerName,
      'isHost': isHost,
    });
  }

  void disconnect() {
    socket?.disconnect();
    socket = null;
  }
}
