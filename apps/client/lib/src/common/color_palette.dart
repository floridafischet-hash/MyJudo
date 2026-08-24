import 'package:flutter/material.dart';

const List<String> kCalendarColorPalette = [
  '#E53935',
  '#D81B60',
  '#8E24AA',
  '#5E35B1',
  '#3949AB',
  '#1E88E5',
  '#00897B',
  '#43A047',
  '#C0CA33',
  '#FB8C00',
  '#6D4C41',
  '#546E7A',
];

Color parseHexColor(String? hex, {Color fallback = const Color(0xFF0B4F8A)}) {
  if (hex == null) return fallback;
  final cleaned = hex.replaceAll('#', '');
  final value = int.tryParse(cleaned, radix: 16);
  if (value == null || cleaned.length != 6) return fallback;
  return Color(0xFF000000 | value);
}

String colorToHex(Color color) {
  int channel(double v) => (v * 255).round().clamp(0, 255);
  final r = channel(color.r), g = channel(color.g), b = channel(color.b);
  String hex(int v) => v.toRadixString(16).padLeft(2, '0');
  return '#${hex(r)}${hex(g)}${hex(b)}'.toUpperCase();
}

/// Palette of quick-pick swatches plus a "custom color" button that opens a
/// free HSV picker, so any color (not just the palette) can be chosen.
class ColorSwatchPicker extends StatelessWidget {
  const ColorSwatchPicker({
    super.key,
    required this.value,
    required this.onChanged,
    this.colors = kCalendarColorPalette,
  });
  final String value;
  final List<String> colors;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    final isCustom = !colors.any((c) => c.toUpperCase() == value.toUpperCase());
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final hex in colors) _Swatch(hex: hex, selected: hex.toUpperCase() == value.toUpperCase(), onTap: () => onChanged(hex)),
        InkWell(
          onTap: () async {
            final picked = await showFreeColorPicker(context, value);
            if (picked != null) onChanged(picked);
          },
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: isCustom ? parseHexColor(value) : Colors.transparent,
              shape: BoxShape.circle,
              border: Border.all(
                color: isCustom ? Colors.black87 : Colors.black45,
                width: isCustom ? 3 : 1,
              ),
            ),
            child: isCustom
                ? const Icon(Icons.check, color: Colors.white, size: 18)
                : const Icon(Icons.add, size: 18),
          ),
        ),
      ],
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.hex, required this.selected, required this.onTap});
  final String hex;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(20),
    child: Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: parseHexColor(hex),
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? Colors.black87 : Colors.black26,
          width: selected ? 3 : 1,
        ),
      ),
      child: selected ? const Icon(Icons.check, color: Colors.white, size: 18) : null,
    ),
  );
}

class ColorDot extends StatelessWidget {
  const ColorDot({super.key, required this.color, this.size = 10});
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

/// Opens a dialog with an HSV square + hue slider + hex field so any color
/// can be picked freely, not just the fixed palette.
Future<String?> showFreeColorPicker(BuildContext context, String initialHex) =>
    showDialog<String>(
      context: context,
      builder: (_) => _FreeColorDialog(initialHex: initialHex),
    );

class _FreeColorDialog extends StatefulWidget {
  const _FreeColorDialog({required this.initialHex});
  final String initialHex;
  @override
  State<_FreeColorDialog> createState() => _FreeColorDialogState();
}

class _FreeColorDialogState extends State<_FreeColorDialog> {
  late HSVColor hsv = HSVColor.fromColor(parseHexColor(widget.initialHex));
  late final TextEditingController hexField = TextEditingController(
    text: colorToHex(hsv.toColor()),
  );

  void _update(HSVColor next) {
    setState(() {
      hsv = next;
      hexField.text = colorToHex(hsv.toColor());
    });
  }

  void _applyHex(String text) {
    final parsed = RegExp(r'^#?[0-9A-Fa-f]{6}$').hasMatch(text)
        ? parseHexColor(text.startsWith('#') ? text : '#$text')
        : null;
    if (parsed != null) setState(() => hsv = HSVColor.fromColor(parsed));
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Eigene Farbe wählen'),
    content: SizedBox(
      width: 320,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _SaturationValueBox(hsv: hsv, onChanged: _update),
          const SizedBox(height: 14),
          _HueSlider(hue: hsv.hue, onChanged: (h) => _update(hsv.withHue(h))),
          const SizedBox(height: 14),
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: hsv.toColor(),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.black26),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: hexField,
                  decoration: const InputDecoration(labelText: 'Hex-Code'),
                  onChanged: _applyHex,
                ),
              ),
            ],
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Abbrechen'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, colorToHex(hsv.toColor())),
        child: const Text('Übernehmen'),
      ),
    ],
  );
}

class _SaturationValueBox extends StatelessWidget {
  const _SaturationValueBox({required this.hsv, required this.onChanged});
  final HSVColor hsv;
  final ValueChanged<HSVColor> onChanged;
  static const _size = Size(280, 160);

  void _handle(Offset local) {
    final s = (local.dx / _size.width).clamp(0.0, 1.0);
    final v = 1 - (local.dy / _size.height).clamp(0.0, 1.0);
    onChanged(hsv.withSaturation(s).withValue(v));
  }

  @override
  Widget build(BuildContext context) {
    final hueColor = HSVColor.fromAHSV(1, hsv.hue, 1, 1).toColor();
    return GestureDetector(
      onPanDown: (d) => _handle(d.localPosition),
      onPanUpdate: (d) => _handle(d.localPosition),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: _size.width,
          height: _size.height,
          child: Stack(
            children: [
              Container(color: hueColor),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [Colors.white, Colors.transparent],
                  ),
                ),
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black],
                  ),
                ),
              ),
              Positioned(
                left: hsv.saturation * _size.width - 7,
                top: (1 - hsv.value) * _size.height - 7,
                child: Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: const [
                      BoxShadow(color: Colors.black45, blurRadius: 2),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HueSlider extends StatelessWidget {
  const _HueSlider({required this.hue, required this.onChanged});
  final double hue;
  final ValueChanged<double> onChanged;
  static const _width = 280.0;

  void _handle(Offset local) =>
      onChanged((local.dx / _width * 360).clamp(0.0, 360.0));

  @override
  Widget build(BuildContext context) => GestureDetector(
    onPanDown: (d) => _handle(d.localPosition),
    onPanUpdate: (d) => _handle(d.localPosition),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        width: _width,
        height: 22,
        child: Stack(
          children: [
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
              ),
            ),
            Positioned(
              left: hue / 360 * _width - 3,
              child: Container(
                width: 6,
                height: 22,
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.black45),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
