import 'dart:io';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiService {
  // Change this to your backend URL
  // For local development: http://10.0.2.2:5000 (Android emulator)
  // For production: your Render URL
  static const String baseUrl = 'http://10.0.2.2:5000';

  // Create a new game room
  Future<String> createRoom() async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/create-room'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['roomCode'] as String;
      } else {
        throw Exception('Failed to create room: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error creating room: $e');
    }
  }

  // Join an existing game room
  Future<Map<String, dynamic>> joinRoom(String roomCode, String playerName) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/join-room'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'roomCode': roomCode.toUpperCase(),
          'playerName': playerName,
        }),
      );

      if (response.statusCode == 200) {
        return json.decode(response.body) as Map<String, dynamic>;
      } else {
        final error = json.decode(response.body);
        throw Exception(error['error'] ?? 'Failed to join room');
      }
    } catch (e) {
      throw Exception('Error joining room: $e');
    }
  }

  // Upload a photo
  Future<void> uploadPhoto(
    String roomCode,
    String playerId,
    File photoFile,
  ) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/upload-photo'),
      );

      request.fields['roomCode'] = roomCode.toUpperCase();
      request.fields['playerId'] = playerId;

      request.files.add(await http.MultipartFile.fromPath(
        'photo',
        photoFile.path,
      ));

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode != 200) {
        final error = json.decode(response.body);
        throw Exception(error['error'] ?? 'Failed to upload photo');
      }
    } catch (e) {
      throw Exception('Error uploading photo: $e');
    }
  }

  // Start the game
  Future<void> startGame(String roomCode, String playerId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/start-game'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'roomCode': roomCode.toUpperCase(),
          'playerId': playerId,
        }),
      );

      if (response.statusCode != 200) {
        final error = json.decode(response.body);
        throw Exception(error['error'] ?? 'Failed to start game');
      }
    } catch (e) {
      throw Exception('Error starting game: $e');
    }
  }

  // Submit a guess
  Future<void> submitGuess(
    String roomCode,
    String playerId,
    String guessedPlayerId,
    double timeToAnswer,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/submit-guess'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'roomCode': roomCode.toUpperCase(),
          'playerId': playerId,
          'guessedPlayerId': guessedPlayerId,
          'timeToAnswer': timeToAnswer,
        }),
      );

      if (response.statusCode != 200) {
        final error = json.decode(response.body);
        throw Exception(error['error'] ?? 'Failed to submit guess');
      }
    } catch (e) {
      throw Exception('Error submitting guess: $e');
    }
  }
}
