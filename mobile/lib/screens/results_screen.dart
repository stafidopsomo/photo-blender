import 'package:flutter/material.dart';
import '../models/photo_results.dart';
import 'home_screen.dart';

class ResultsScreen extends StatelessWidget {
  final List<LeaderboardEntry> leaderboard;

  const ResultsScreen({
    super.key,
    required this.leaderboard,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Game Over'),
        backgroundColor: const Color(0xFF16213E),
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Trophy Icon
            const Icon(
              Icons.emoji_events,
              size: 100,
              color: Colors.amber,
            ),
            const SizedBox(height: 16),

            // Winner announcement
            if (leaderboard.isNotEmpty) ...[
              const Text(
                'Winner!',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                leaderboard[0].name,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF6C63FF),
                ),
              ),
              Text(
                '${leaderboard[0].score} points',
                style: const TextStyle(
                  fontSize: 20,
                  color: Colors.white70,
                ),
              ),
            ],

            const SizedBox(height: 32),

            // Final standings
            const Text(
              'Final Standings',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 16),

            ...leaderboard.asMap().entries.map((entry) {
              final index = entry.key;
              final player = entry.value;

              Color? podiumColor;
              IconData? medalIcon;

              if (index == 0) {
                podiumColor = Colors.amber;
                medalIcon = Icons.looks_one;
              } else if (index == 1) {
                podiumColor = Colors.grey[400];
                medalIcon = Icons.looks_two;
              } else if (index == 2) {
                podiumColor = Colors.brown[300];
                medalIcon = Icons.looks_3;
              }

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      // Position
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: podiumColor ?? const Color(0xFF6C63FF),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: medalIcon != null
                              ? Icon(medalIcon, color: Colors.white)
                              : Text(
                                  '${index + 1}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 18,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(width: 16),

                      // Player info
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              player.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                            if (player.streak > 0)
                              Text(
                                '🔥 Best streak: ${player.streak}',
                                style: const TextStyle(
                                  color: Colors.orange,
                                  fontSize: 12,
                                ),
                              ),
                          ],
                        ),
                      ),

                      // Score
                      Text(
                        '${player.score}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 24,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Text(
                        'pts',
                        style: TextStyle(
                          color: Colors.white54,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 32),

            // Play again button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const HomeScreen(),
                    ),
                    (route) => false,
                  );
                },
                icon: const Icon(Icons.replay),
                label: const Text('Play Again'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
