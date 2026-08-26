import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/browser_title/browser_title_value.dart';

void main() {
  test('browser title contains exactly the unread message count', () {
    expect(myJudoBrowserTitle(0), 'Zenyo Kizuna');
    expect(myJudoBrowserTitle(1), 'Zenyo Kizuna (1)');
    expect(myJudoBrowserTitle(5), 'Zenyo Kizuna (5)');
  });
}
