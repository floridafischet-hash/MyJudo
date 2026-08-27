import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/downloads/downloads_page.dart';

void main() {
  group('formatDownloadSize', () {
    test('accepts PostgreSQL bigint values encoded as strings', () {
      expect(formatDownloadSize('2048'), '2.0 KB');
    });

    test('accepts numeric JSON values', () {
      expect(formatDownloadSize(1048576), '1.0 MB');
    });

    test('does not crash on malformed API data', () {
      expect(formatDownloadSize('invalid'), 'Unbekannte Größe');
    });
  });
}
