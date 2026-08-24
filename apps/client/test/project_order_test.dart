import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/projects/projects_page.dart';

void main() {
  group('reorderedList', () {
    test('moves an item down and shifts the ones in between up', () {
      expect(reorderedList(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
    });

    test('moves an item up and shifts the ones in between down', () {
      expect(reorderedList(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']);
    });

    test('moving an item to its own position is a no-op', () {
      expect(reorderedList(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c']);
    });

    test('does not mutate the original list', () {
      final original = ['a', 'b', 'c'];
      reorderedList(original, 0, 2);
      expect(original, ['a', 'b', 'c']);
    });
  });
}
