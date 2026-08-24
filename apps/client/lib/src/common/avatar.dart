import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';

/// Renders an avatar image fetched from an authenticated API endpoint
/// (an absolute path like `/api/v1/users/.../avatar`), falling back to
/// [fallback] while loading, on error, or when [url] is null.
class AvatarImage extends StatefulWidget {
  const AvatarImage({
    super.key,
    required this.url,
    required this.accessToken,
    this.radius = 20,
    this.fallback,
  });
  final String? url;
  final String accessToken;
  final double radius;
  final Widget? fallback;
  @override
  State<AvatarImage> createState() => _AvatarImageState();
}

class _AvatarImageState extends State<AvatarImage> {
  Future<Uint8List>? _future;

  @override
  void initState() {
    super.initState();
    _future = widget.url == null ? null : _load(widget.url!);
  }

  @override
  void didUpdateWidget(covariant AvatarImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.url != oldWidget.url) {
      setState(() => _future = widget.url == null ? null : _load(widget.url!));
    }
  }

  Future<Uint8List> _load(String url) async {
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 30),
      ),
    );
    try {
      final fullUrl = '${Uri.parse(AppConfig.apiBaseUrl).origin}$url';
      final response = await dio.get<List<int>>(
        fullUrl,
        options: Options(responseType: ResponseType.bytes),
      );
      return Uint8List.fromList(response.data ?? const []);
    } finally {
      dio.close();
    }
  }

  @override
  Widget build(BuildContext context) {
    final fallback =
        widget.fallback ??
        CircleAvatar(radius: widget.radius, child: const Icon(Icons.person));
    if (_future == null) return fallback;
    return FutureBuilder<Uint8List>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) return fallback;
        return CircleAvatar(
          radius: widget.radius,
          backgroundImage: MemoryImage(snapshot.data!),
        );
      },
    );
  }
}

/// Avatar preview plus "change"/"remove" controls, calling [onUpload] /
/// [onDelete] which perform the actual API request.
class AvatarPicker extends StatefulWidget {
  const AvatarPicker({
    super.key,
    required this.url,
    required this.accessToken,
    required this.onUpload,
    required this.onDelete,
    this.fallback,
    this.radius = 28,
  });
  final String? url;
  final String accessToken;
  final Future<void> Function(Uint8List bytes, String filename) onUpload;
  final Future<void> Function() onDelete;
  final Widget? fallback;
  final double radius;
  @override
  State<AvatarPicker> createState() => _AvatarPickerState();
}

class _AvatarPickerState extends State<AvatarPicker> {
  bool _busy = false;

  Future<void> _pick() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: false,
      withData: true,
    );
    if (result == null || !mounted) return;
    final file = result.files.single;
    final bytes = file.bytes;
    if (bytes == null || bytes.isEmpty) return;
    if (bytes.length > 5 * 1024 * 1024) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Das Bild ist zu groß. Maximal erlaubt sind 5 MB.'),
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.onUpload(bytes, file.name);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bild konnte nicht hochgeladen werden.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    setState(() => _busy = true);
    try {
      await widget.onDelete();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bild konnte nicht entfernt werden.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Row(
    children: [
      AvatarImage(
        url: widget.url,
        accessToken: widget.accessToken,
        radius: widget.radius,
        fallback: widget.fallback,
      ),
      const SizedBox(width: 14),
      Wrap(
        spacing: 8,
        children: [
          OutlinedButton.icon(
            onPressed: _busy ? null : _pick,
            icon: const Icon(Icons.upload_outlined, size: 18),
            label: const Text('Bild ändern'),
          ),
          if (widget.url != null)
            TextButton.icon(
              onPressed: _busy ? null : _remove,
              icon: const Icon(Icons.delete_outline, size: 18),
              label: const Text('Entfernen'),
            ),
        ],
      ),
      if (_busy) ...[
        const SizedBox(width: 10),
        const SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ],
    ],
  );
}
