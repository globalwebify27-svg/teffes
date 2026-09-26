import 'package:youtube_player_iframe/youtube_player_iframe.dart';

class VideoUtils {
  /// Checks whether a given URL points to a YouTube video.
  static bool isYouTubeUrl(String? url) {
    if (url == null || url.trim().isEmpty) return false;
    final clean = url.trim().toLowerCase();
    return clean.contains('youtube.com') ||
        clean.contains('youtu.be') ||
        clean.contains('youtube-nocookie.com');
  }

  /// Extracts the 11-character YouTube video ID.
  static String? getYouTubeVideoId(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    final converted = YoutubePlayerController.convertUrlToId(url.trim());
    if (converted != null && converted.isNotEmpty) return converted;

    final regExp = RegExp(
      r'(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})',
      caseSensitive: false,
    );
    final match = regExp.firstMatch(url.trim());
    return match?.group(1);
  }

  /// Returns the standard high quality thumbnail URL for YouTube videos.
  static String? getYouTubeThumbnailUrl(String? url) {
    final id = getYouTubeVideoId(url);
    if (id == null) return null;
    return 'https://img.youtube.com/vi/$id/hqdefault.jpg';
  }
}
