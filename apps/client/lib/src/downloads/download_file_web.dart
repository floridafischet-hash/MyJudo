// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;

void saveDownload(List<int> bytes, String name, String mime) {
  final url = html.Url.createObjectUrlFromBlob(html.Blob([bytes], mime));
  html.AnchorElement(href: url)
    ..download = name
    ..click();
  html.Url.revokeObjectUrl(url);
}

String openBlobPreview(List<int> bytes, String mime) {
  final url = html.Url.createObjectUrlFromBlob(html.Blob([bytes], mime));
  html.window.open(url, '_blank');
  return url;
}

void revokeBlobUrl(String url) => html.Url.revokeObjectUrl(url);
