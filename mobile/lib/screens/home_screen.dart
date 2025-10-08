import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'lobby_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _roomCodeController = TextEditingController();
  final ApiService _apiService = ApiService();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _roomCodeController.dispose();
    super.dispose();
  }

  Future<void> _createRoom() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() {
        _error = 'Please enter your name';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final roomCode = await _apiService.createRoom();
      final joinData = await _apiService.joinRoom(roomCode, _nameController.text.trim());

      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => LobbyScreen(
            roomCode: roomCode,
            playerId: joinData['playerId'] as String,
            playerName: _nameController.text.trim(),
            isHost: joinData['isHost'] as bool? ?? true,
          ),
        ),
      );
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _joinRoom() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() {
        _error = 'Please enter your name';
      });
      return;
    }

    if (_roomCodeController.text.trim().isEmpty) {
      setState(() {
        _error = 'Please enter room code';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final joinData = await _apiService.joinRoom(
        _roomCodeController.text.trim().toUpperCase(),
        _nameController.text.trim(),
      );

      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => LobbyScreen(
            roomCode: joinData['roomCode'] as String,
            playerId: joinData['playerId'] as String,
            playerName: _nameController.text.trim(),
            isHost: joinData['isHost'] as bool? ?? false,
          ),
        ),
      );
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // App Logo/Title
                const Icon(
                  Icons.camera_alt_rounded,
                  size: 80,
                  color: Color(0xFF6C63FF),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Photo Roulette',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Upload photos, guess who!',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.7),
                  ),
                ),
                const SizedBox(height: 48),

                // Name Input
                TextField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Your Name',
                    prefixIcon: Icon(Icons.person, color: Color(0xFF6C63FF)),
                  ),
                  textCapitalization: TextCapitalization.words,
                  enabled: !_loading,
                ),
                const SizedBox(height: 24),

                // Create Room Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _loading ? null : _createRoom,
                    icon: const Icon(Icons.add),
                    label: const Text('Create New Room'),
                  ),
                ),
                const SizedBox(height: 16),

                // Divider
                Row(
                  children: [
                    const Expanded(child: Divider(color: Colors.white24)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        'OR',
                        style: TextStyle(color: Colors.white.withOpacity(0.5)),
                      ),
                    ),
                    const Expanded(child: Divider(color: Colors.white24)),
                  ],
                ),
                const SizedBox(height: 16),

                // Room Code Input
                TextField(
                  controller: _roomCodeController,
                  decoration: const InputDecoration(
                    labelText: 'Room Code',
                    prefixIcon: Icon(Icons.meeting_room, color: Color(0xFF6C63FF)),
                  ),
                  textCapitalization: TextCapitalization.characters,
                  enabled: !_loading,
                ),
                const SizedBox(height: 16),

                // Join Room Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _loading ? null : _joinRoom,
                    icon: const Icon(Icons.login),
                    label: const Text('Join Room'),
                  ),
                ),

                // Error Message
                if (_error != null) ...[
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error, color: Colors.red),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _error!,
                            style: const TextStyle(color: Colors.red),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Loading Indicator
                if (_loading) ...[
                  const SizedBox(height: 24),
                  const CircularProgressIndicator(),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
