// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;

import 'browser_title_value.dart';

void setMyJudoBrowserTitle(int unreadCount) {
  html.document.title = myJudoBrowserTitle(unreadCount);
}
