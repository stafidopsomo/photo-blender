import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/game_state.dart';
import '../models/player.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import 'game_screen.dart';

class LobbyScreen extends StatefulWidget {
  final String roomCode;
  final String playerId;
  final String playerName;
  final bool isHost;

  const LobbyScreen({
    super.key,
    required this.roomCode,
    required this.playerId,
    required this.playerName,
    required this.isHost,
  });

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  final ApiService _apiService = ApiService();
  final SocketService _socketService = SocketService();
  final ImagePicker _imagePicker = ImagePicker();

  GameState? _gameState;
  bool _uploading = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _setupSocket();
  }

  void _setupSocket() {
    _socketService.onGameState = (data) {
      setState(() {
        _gameState = GameState.fromJson(
          data,
          widget.roomCode,
          widget.playerId,
          widget.playerName,
          widget.isHost,
        );
      });
    };

    _socketService.onPlayerJoined = (playerName, totalPlayers) {
      _showMessage('$playerName joined!');
    };

    _socketService.onPlayerLeft = (playerName, totalPlayers) {
      _showMessage('$playerName left');
    };

    _socketService.onPhotoUploaded = (playerName, totalPhotos, canStartGame) {
      setState(() {
        if (_gameState != null) {
          _gameState = _gameState!.copyWith(
            totalPhotos: totalPhotos,
            canStartGame: canStartGame,
          );
        }
      });
      _showMessage('$playerName uploaded a photo!');
    };

    _socketService.onGameStarted = (totalPhotos, players) {
      // Navigate to game screen
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => GameScreen(
            roomCode: widget.roomCode,
            playerId: widget.playerId,
            playerName: widget.playerName,
            isHost: widget.isHost,
            socketService: _socketService,
          ),
        ),
      );
    };

    _socketService.connect();
    _socketService.joinRoom(
      widget.roomCode,
      widget.playerId,
      widget.playerName,
      widget.isHost,
    );
  }

  void _showMessage(String message) {
    setState(() {
      _message = message;
    });
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _message = null;
        });
      }
    });
  }

  Future<void> _pickAndUploadPhoto(ImageSource source) async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: source,
        imageQuality: 80,
        maxWidth: 1920,
        maxHeight: 1920,
      );

      if (image == null) return;

      setState(() {
        _uploading = true;
      });

      await _apiService.uploadPhoto(
        widget.roomCode,
        widget.playerId,
        File(image.path),
      );

      setState(() {
        _uploading = false;
      });

      _showMessage('Photo uploaded successfully!');
    } catch (e) {
      setState(() {
        _uploading = false;
      });
      _showMessage('Failed to upload photo: ${e.toString()}');
    }
  }

  void _showPhotoSourceDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF16213E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Color(0xFF6C63FF)),
                title: const Text('Take Photo', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  _pickAndUploadPhoto(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: Color(0xFF6C63FF)),
                title: const Text('Choose from Gallery', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  _pickAndUploadPhoto(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _startGame() async {
    try {
      await _apiService.startGame(widget.roomCode, widget.playerId);
    } catch (e) {
      _showMessage('Failed to start game: ${e.toString()}');
    }
  }

  @override
  void dispose() {
    _socketService.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canStartGame = _gameState?.canStartGame ?? false;

    return Scaffold(
      appBar: AppBar(
        title: Text('Room: ${widget.roomCode}'),
        backgroundColor: const Color(0xFF16213E),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  backgroundColor: const Color(0xFF16213E),
                  title: const Text('Game Rules'),
                  content: const Text(
                    'Need at least:\n'
                    '• 2 players with photos\n'
                    '• 10 total photos\n\n'
                    'Upload 5+ photos per player!',
                    style: TextStyle(color: Colors.white70),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('OK'),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: _gameState == null
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Message Banner
                if (_message != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    color: const Color(0xFF6C63FF),
                    child: Text(
                      _message!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),

                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Stats Card
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: [
                                    _buildStatItem(
                                      Icons.people,
                                      '${_gameState!.players.length}',
                                      'Players',
                                    ),
                                    _buildStatItem(
                                      Icons.photo,
                                      '${_gameState!.totalPhotos}',
                                      'Photos',
                                    ),
                                  ],
                                ),
                                if (!canStartGame) ...[
                                  const SizedBox(height: 16),
                                  const Divider(),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Need 2+ players and 10+ photos to start',
                                    style: TextStyle(color: Colors.orange, fontSize: 12),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Players List
                        const Text(
                          'Players',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ..._gameState!.players.map((player) => _buildPlayerCard(player)),
                      ],
                    ),
                  ),
                ),

                // Bottom Action Bar
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16213E),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, -2),
                      ),
                    ],
                  ),
                  child: SafeArea(
                    child: widget.isHost
                        ? Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: _uploading ? null : _showPhotoSourceDialog,
                                  icon: _uploading
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                      : const Icon(Icons.add_a_photo),
                                  label: Text(_uploading ? 'Uploading...' : 'Upload Photo'),
                                ),
                              ),
                              const SizedBox(height: 8),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: canStartGame ? _startGame : null,
                                  icon: const Icon(Icons.play_arrow),
                                  label: const Text('Start Game'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: canStartGame
                                        ? Colors.green
                                        : Colors.grey,
                                  ),
                                ),
                              ),
                            ],
                          )
                        : SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _uploading ? null : _showPhotoSourceDialog,
                              icon: _uploading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.add_a_photo),
                              label: Text(_uploading ? 'Uploading...' : 'Upload Photo'),
                            ),
                          ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildStatItem(IconData icon, String value, String label) {
    return Column(
      children: [
        Icon(icon, color: const Color(0xFF6C63FF), size: 32),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        Text(
          label,
          style: const TextStyle(color: Colors.white54, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildPlayerCard(Player player) {
    final isMe = player.id == widget.playerId;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFF6C63FF),
          child: Text(
            player.name[0].toUpperCase(),
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
        ),
        title: Row(
          children: [
            Text(
              player.name,
              style: TextStyle(
                color: Colors.white,
                fontWeight: isMe ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            if (isMe) ...[
              const SizedBox(width: 8),
              const Text(
                '(You)',
                style: TextStyle(color: Color(0xFF6C63FF), fontSize: 12),
              ),
            ],
            if (player.isHost) ...[
              const SizedBox(width: 8),
              const Icon(Icons.star, color: Colors.amber, size: 16),
            ],
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.photo, color: Color(0xFF6C63FF), size: 16),
            const SizedBox(width: 4),
            Text(
              '${player.photosUploaded}',
              style: const TextStyle(color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }
}
