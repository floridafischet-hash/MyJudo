import 'download_file_stub.dart'
    if (dart.library.html) 'download_file_web.dart'
    as platform;

void saveDownload(List<int> bytes, String name, String mime) =>
    platform.saveDownload(bytes, name, mime);

/// Opens the file in a new browser tab as a blob URL.
/// Returns the blob URL so the caller can revoke it later.
String openBlobPreview(List<int> bytes, String mime) =>
    platform.openBlobPreview(bytes, mime);

void revokeBlobUrl(String url) => platform.revokeBlobUrl(url);
