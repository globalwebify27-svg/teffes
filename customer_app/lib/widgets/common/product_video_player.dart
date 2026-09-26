import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/video_utils.dart';

class ProductVideoPlayer extends StatefulWidget {
  final String videoUrl;
  final bool isActive;

  const ProductVideoPlayer({
    super.key,
    required this.videoUrl,
    this.isActive = true,
  });

  @override
  State<ProductVideoPlayer> createState() => _ProductVideoPlayerState();
}

class _ProductVideoPlayerState extends State<ProductVideoPlayer> {
  bool _isYouTube = false;
  String? _youTubeVideoId;
  YoutubePlayerController? _ytController;
  VideoPlayerController? _videoController;
  bool _isInitialized = false;
  bool _hasError = false;
  bool _isMuted = true;

  @override
  void initState() {
    super.initState();
    _initPlayer();
  }

  @override
  void didUpdateWidget(covariant ProductVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isActive != widget.isActive) {
      if (widget.isActive) {
        if (_isYouTube) {
          _ytController?.playVideo();
        } else {
          _videoController?.play();
        }
      } else {
        if (_isYouTube) {
          _ytController?.pauseVideo();
        } else {
          _videoController?.pause();
        }
      }
    }
  }

  void _initPlayer() {
    final url = widget.videoUrl.trim();
    if (VideoUtils.isYouTubeUrl(url)) {
      _isYouTube = true;
      final videoId = VideoUtils.getYouTubeVideoId(url);
      _youTubeVideoId = videoId;
      if (videoId != null && videoId.isNotEmpty) {
        _ytController = YoutubePlayerController.fromVideoId(
          videoId: videoId,
          autoPlay: true,
          params: const YoutubePlayerParams(
            showControls: true,
            showFullscreenButton: true,
            mute: true,
            origin: 'https://www.youtube-nocookie.com',
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
              if (widget.isActive) {
                _videoController!.play();
              }
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

  Future<void> _openInYouTube() async {
    final videoId = _youTubeVideoId;
    if (videoId == null) return;
    final appUri = Uri.parse('vnd.youtube:$videoId');
    final webUri = Uri.parse('https://www.youtube.com/watch?v=$videoId');
    try {
      if (await canLaunchUrl(appUri)) {
        await launchUrl(appUri);
      } else {
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
    }
  }

  void _toggleSound() {
    if (_ytController == null) return;
    if (_isMuted) {
      _ytController!.unMute();
      setState(() {
        _isMuted = false;
      });
    } else {
      _ytController!.mute();
      setState(() {
        _isMuted = true;
      });
    }
  }

  @override
  void dispose() {
    _ytController?.close();
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return Container(
        color: Colors.black87,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.videocam_off_rounded, color: Colors.white60, size: 36),
              const SizedBox(height: 8),
              const Text(
                'Unable to play video',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
              if (_isYouTube && _youTubeVideoId != null) ...[
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: _openInYouTube,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  icon: const Icon(Icons.play_arrow_rounded, size: 18),
                  label: const Text('Watch on YouTube', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ],
            ],
          ),
        ),
      );
    }

    if (_isYouTube && _ytController != null) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: YoutubeValueBuilder(
          controller: _ytController!,
          builder: (context, value) {
            if (value.hasError) {
              return Container(
                color: Colors.black87,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.lock_outline_rounded, color: Colors.amber, size: 36),
                      const SizedBox(height: 8),
                      const Text(
                        'Playback Restricted by Video Owner',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'The creator has restricted embedding on external apps.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                      if (_youTubeVideoId != null) ...[
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          onPressed: _openInYouTube,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red.shade700,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          ),
                          icon: const Icon(Icons.play_arrow_rounded, size: 18),
                          label: const Text('Watch on YouTube App', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }

            final isPlaying = value.playerState == PlayerState.playing;
            final isBuffering = value.playerState == PlayerState.buffering;

            return Stack(
              alignment: Alignment.center,
              children: [
                YoutubePlayer(
                  controller: _ytController!,
                  aspectRatio: 16 / 9,
                ),
                // Play / Pause central button overlay when not playing
                if (!isPlaying)
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      _ytController!.playVideo();
                      _ytController!.unMute();
                      setState(() {
                        _isMuted = false;
                      });
                    },
                    child: Container(
                      color: Colors.black26,
                      alignment: Alignment.center,
                      child: isBuffering
                          ? const CircularProgressIndicator(
                              color: AppColors.primaryMaroon,
                              strokeWidth: 3,
                            )
                          : Container(
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.65),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.4),
                                    blurRadius: 10,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.all(16),
                              child: const Icon(
                                Icons.play_arrow_rounded,
                                size: 48,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                // Sound Mute / Unmute pill button (top-left)
                Positioned(
                  top: 10,
                  left: 10,
                  child: Material(
                    color: Colors.black.withValues(alpha: 0.65),
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: _toggleSound,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                              color: Colors.white,
                              size: 15,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              _isMuted ? 'Unmute' : 'Sound On',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                // YouTube App launcher badge (top-right)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Material(
                    color: Colors.black.withValues(alpha: 0.65),
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: _openInYouTube,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.open_in_new_rounded, color: Colors.white, size: 14),
                            SizedBox(width: 5),
                            Text(
                              'YouTube App',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
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
