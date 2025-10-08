import 'dart:async';
import 'package:flutter/material.dart';
import '../models/photo_data.dart';
import '../models/photo_results.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import 'results_screen.dart';

class GameScreen extends StatefulWidget {
  final String roomCode;
  final String playerId;
  final String playerName;
  final bool isHost;
  final SocketService socketService;

  const GameScreen({
    super.key,
    required this.roomCode,
    required this.playerId,
    required this.playerName,
    required this.isHost,
    required this.socketService,
  });

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  final ApiService _apiService = ApiService();

  PhotoData? _currentPhoto;
  PhotoResults? _photoResults;
  String? _selectedPlayerId;
  bool _hasSubmitted = false;
  int _timeRemaining = 30;
  Timer? _timer;
  DateTime? _photoStartTime;

  @override
  void initState() {
    super.initState();
    _setupSocketListeners();
  }

  void _setupSocketListeners() {
    widget.socketService.onNewPhoto = (data) {
      setState(() {
        _currentPhoto = PhotoData.fromJson(data);
        _photoResults = null;
        _selectedPlayerId = null;
        _hasSubmitted = false;
        _timeRemaining = 30;
        _photoStartTime = DateTime.now();
      });
      _startTimer();
    };

    widget.socketService.onPhotoResults = (data) {
      _timer?.cancel();
      setState(() {
        _photoResults = PhotoResults.fromJson(data);
      });
    };

    widget.socketService.onGameFinished = (leaderboard) {
      _timer?.cancel();
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => ResultsScreen(
            leaderboard: leaderboard
                .map((l) => LeaderboardEntry.fromJson(l))
                .toList(),
          ),
        ),
      );
    };
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_timeRemaining > 0) {
          _timeRemaining--;
        } else {
          timer.cancel();
        }
      });
    });
  }

  Future<void> _submitGuess() async {
    if (_selectedPlayerId == null || _hasSubmitted) return;

    final timeToAnswer = _photoStartTime != null
        ? DateTime.now().difference(_photoStartTime!).inSeconds.toDouble()
        : 30.0;

    setState(() {
      _hasSubmitted = true;
    });

    try {
      await _apiService.submitGuess(
        widget.roomCode,
        widget.playerId,
        _selectedPlayerId!,
        timeToAnswer,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit: ${e.toString()}')),
        );
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_photoResults != null) {
      return _buildResultsView();
    }

    if (_currentPhoto == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Photo Roulette'),
          backgroundColor: const Color(0xFF16213E),
        ),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text(
                'Get ready!',
                style: TextStyle(fontSize: 24, color: Colors.white),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('${_currentPhoto!.photoIndex} / ${_currentPhoto!.totalPhotos}'),
        backgroundColor: const Color(0xFF16213E),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _timeRemaining <= 5 ? Colors.red : const Color(0xFF6C63FF),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.timer, size: 16),
                    const SizedBox(width: 4),
                    Text(
                      '$_timeRemaining s',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Progress bar
          LinearProgressIndicator(
            value: _timeRemaining / 30,
            backgroundColor: Colors.grey[800],
            valueColor: AlwaysStoppedAnimation<Color>(
              _timeRemaining <= 5 ? Colors.red : const Color(0xFF6C63FF),
            ),
          ),

          Expanded(
            child: Column(
              children: [
                // Photo
                Expanded(
                  flex: 3,
                  child: Container(
                    width: double.infinity,
                    color: Colors.black,
                    child: _currentPhoto!.photoUrl.startsWith('http')
                        ? Image.network(
                            _currentPhoto!.photoUrl,
                            fit: BoxFit.contain,
                            loadingBuilder: (context, child, loadingProgress) {
                              if (loadingProgress == null) return child;
                              return const Center(child: CircularProgressIndicator());
                            },
                            errorBuilder: (context, error, stackTrace) {
                              return const Center(
                                child: Icon(Icons.error, color: Colors.red, size: 48),
                              );
                            },
                          )
                        : const Center(
                            child: Icon(Icons.photo, color: Colors.white54, size: 80),
                          ),
                  ),
                ),

                // Question
                Container(
                  padding: const EdgeInsets.all(16),
                  color: const Color(0xFF16213E),
                  child: const Text(
                    'Whose photo is this?',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),

                // Player options
                Expanded(
                  flex: 2,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _currentPhoto!.players.length,
                    itemBuilder: (context, index) {
                      final player = _currentPhoto!.players[index];
                      final isSelected = _selectedPlayerId == player.id;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        color: isSelected
                            ? const Color(0xFF6C63FF)
                            : const Color(0xFF16213E),
                        child: ListTile(
                          onTap: _hasSubmitted
                              ? null
                              : () {
                                  setState(() {
                                    _selectedPlayerId = player.id;
                                  });
                                },
                          leading: CircleAvatar(
                            backgroundColor: isSelected
                                ? Colors.white
                                : const Color(0xFF6C63FF),
                            child: Text(
                              player.name[0].toUpperCase(),
                              style: TextStyle(
                                color: isSelected
                                    ? const Color(0xFF6C63FF)
                                    : Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          title: Text(
                            player.name,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          trailing: isSelected
                              ? const Icon(Icons.check_circle, color: Colors.white)
                              : null,
                        ),
                      );
                    },
                  ),
                ),

                // Submit button
                Container(
                  padding: const EdgeInsets.all(16),
                  child: SafeArea(
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: (_selectedPlayerId != null && !_hasSubmitted)
                            ? _submitGuess
                            : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _hasSubmitted
                              ? Colors.green
                              : const Color(0xFF6C63FF),
                        ),
                        child: Text(
                          _hasSubmitted ? 'Submitted ✓' : 'Submit Guess',
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultsView() {
    final myGuess = _photoResults!.guesses.firstWhere(
      (g) => g.guesser == widget.playerName,
      orElse: () => GuessResult(
        guesser: widget.playerName,
        guessed: 'No guess',
        correct: false,
      ),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Round Results'),
        backgroundColor: const Color(0xFF16213E),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Correct answer
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(
                      myGuess.correct ? Icons.check_circle : Icons.cancel,
                      size: 64,
                      color: myGuess.correct ? Colors.green : Colors.red,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      myGuess.correct ? 'Correct!' : 'Wrong!',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: myGuess.correct ? Colors.green : Colors.red,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'The photo belongs to:',
                      style: TextStyle(color: Colors.white70),
                    ),
                    Text(
                      _photoResults!.correctPlayer,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Leaderboard
            const Text(
              'Current Standings',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            ..._photoResults!.leaderboard.asMap().entries.map((entry) {
              final index = entry.key;
              final player = entry.value;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: index == 0
                        ? Colors.amber
                        : const Color(0xFF6C63FF),
                    child: Text(
                      '${index + 1}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  title: Text(
                    player.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${player.score} pts',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      if (player.streak > 0)
                        Text(
                          '🔥 ${player.streak} streak',
                          style: const TextStyle(
                            color: Colors.orange,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
