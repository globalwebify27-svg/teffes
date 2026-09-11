import 'package:flutter/material.dart';

class SmoothPageRoute<T> extends PageRouteBuilder<T> {
  final Widget page;

  SmoothPageRoute({required this.page})
      : super(
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionDuration: const Duration(milliseconds: 260),
          reverseTransitionDuration: const Duration(milliseconds: 240),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            // Smooth subtle slide-up + fade transition
            const begin = Offset(0.04, 0.0);
            const end = Offset.zero;
            final curve = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            );

            return SlideTransition(
              position: Tween<Offset>(begin: begin, end: end).animate(curve),
              child: FadeTransition(
                opacity: Tween<double>(begin: 0.85, end: 1.0).animate(curve),
                child: child,
              ),
            );
          },
        );
}
