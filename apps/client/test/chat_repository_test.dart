import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/chat/chat_repository.dart';

void main() {
  group('chatMessageQueryParameters', () {
    test('omits the cursor on the first message page', () {
      expect(chatMessageQueryParameters(null), {'limit': 50});
      expect(chatMessageQueryParameters(''), {'limit': 50});
    });

    test('includes the cursor on subsequent pages', () {
      const cursor = '3f059e20-6c7c-49c7-9be8-e252339d2b00';
      expect(chatMessageQueryParameters(cursor), {
        'limit': 50,
        'before': cursor,
      });
    });
  });
}
