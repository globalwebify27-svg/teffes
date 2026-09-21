import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/video_utils.dart';

class ProductVideoPlayer extends StatefulWidget {
  final String videoUrl;

  const ProductVideoPlayer({super.key, required this.videoUrl});

  @override
  State<ProductVideoPlayer> createState() => _ProductVideoPlayerState();
}

class _ProductVideoPlayerState extends State<ProductVideoPlayer> {
  bool _isYouTube = false;
  YoutubePlayerController? _ytController;
  VideoPlayerController? _videoController;
  bool _isInitialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _initPlayer();
  }

  void _initPlayer() {
    final url = widget.videoUrl.trim();
    if (VideoUtils.isYouTubeUrl(url)) {
      _isYouTube = true;
      final videoId = VideoUtils.getYouTubeVideoId(url);
      if (videoId != null && videoId.isNotEmpty) {
        _ytController = YoutubePlayerController(
          initialVideoId: videoId,
          flags: const YoutubePlayerFlags(
            autoPlay: false,
            mute: false,
            enableCaption: false,
            forceHD: false,
          ),
        );
        _isInitialized = true;
      } else {
        _hasError = true;
      }
    } else {
      _isYouTube = false;
      try {
        final uri = Uri.parse(url);
        _videoController = VideoPlayerController.networkUrl(uri)
          ..initialize().then((_) {
            if (mounted) {
              setState(() {
                _isInitialized = true;
              });
            }
          }).catchError((err) {
            if (mounted) {
              setState(() {
                _hasError = true;
              });
            }
          });
      } catch (_) {
        _hasError = true;
      }
    }
  }

  @override
  void dispose() {
    _ytController?.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return Container(
        color: Colors.black87,
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.videocam_off_rounded, color: Colors.white60, size: 36),
              SizedBox(height: 8),
              Text(
                'Unable to play video',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }

    if (_isYouTube && _ytController != null) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: YoutubePlayer(
          controller: _ytController!,
          showVideoProgressIndicator: true,
          progressIndicatorColor: AppColors.primaryMaroon,
          progressColors: const ProgressBarColors(
            playedColor: AppColors.primaryMaroon,
            handleColor: AppColors.primaryLight,
          ),
        ),
      );
    }

    if (!_isInitialized || _videoController == null) {
      return Container(
        color: Colors.black87,
        child: const Center(
          child: CircularProgressIndicator(
            color: AppColors.primaryMaroon,
            strokeWidth: 2.5,
          ),
        ),
      );
    }

    final isPlaying = _videoController!.value.isPlaying;

    return GestureDetector(
      onTap: () {
        setState(() {
          if (isPlaying) {
            _videoController!.pause();
          } else {
            _videoController!.play();
          }
        });
      },
      child: Container(
        color: Colors.black,
        child: Stack(
          alignment: Alignment.center,
          children: [
            AspectRatio(
              aspectRatio: _videoController!.value.aspectRatio > 0
                  ? _videoController!.value.aspectRatio
                  : 1.25,
              child: VideoPlayer(_videoController!),
            ),
            if (!isPlaying)
              Container(
                decoration: const BoxDecoration(
                  color: Colors.black45,
                  shape: BoxShape.circle,
                ),
                padding: const EdgeInsets.all(12),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  size: 42,
                  color: Colors.white,
                ),
              ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: VideoProgressIndicator(
                _videoController!,
                allowScrubbing: true,
                colors: const VideoProgressColors(
                  playedColor: AppColors.primaryMaroon,
                  bufferedColor: Colors.white24,
                  backgroundColor: Colors.transparent,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
