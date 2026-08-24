import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/browser_title/browser_title_value.dart';

void main() {
  test('browser title contains exactly the unread message count', () {
    expect(myJudoBrowserTitle(0), 'MyJudo');
    expect(myJudoBrowserTitle(1), 'MyJudo (1)');
    expect(myJudoBrowserTitle(5), 'MyJudo (5)');
  });
}
