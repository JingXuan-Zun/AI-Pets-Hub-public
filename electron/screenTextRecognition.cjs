const OCR_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function powerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Windows' built-in OCR (Windows.Media.Ocr), preferring Chinese, which also reads
 * English and digits. Runs locally in well under a second; used to snap a click
 * point onto the exact text the vision model only located approximately.
 */
function createScreenTextRecognitionScript(imagePath, outputPath) {
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]
function Await($Operation, [Type]$ResultType) {
  $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $null = $task.Wait(-1)
  return $task.Result
}
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync(${powerShellLiteral(imagePath)})) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = $null
foreach ($tag in @('zh-Hans-CN', 'zh-Hans', 'zh-CN')) {
  try { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new($tag)) } catch { $engine = $null }
  if ($engine) { break }
}
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $engine) { throw 'No OCR language is installed' }
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$lines = @()
foreach ($line in $result.Lines) {
  $words = @($line.Words)
  if ($words.Count -eq 0) { continue }
  $left = ($words | ForEach-Object { $_.BoundingRect.X } | Measure-Object -Minimum).Minimum
  $top = ($words | ForEach-Object { $_.BoundingRect.Y } | Measure-Object -Minimum).Minimum
  $right = ($words | ForEach-Object { $_.BoundingRect.X + $_.BoundingRect.Width } | Measure-Object -Maximum).Maximum
  $bottom = ($words | ForEach-Object { $_.BoundingRect.Y + $_.BoundingRect.Height } | Measure-Object -Maximum).Maximum
  $lines += [pscustomobject]@{ text = $line.Text; x = $left; y = $top; width = $right - $left; height = $bottom - $top }
}
$json = ConvertTo-Json -InputObject @{ language = $engine.RecognizerLanguage.LanguageTag; lines = @($lines) } -Depth 4 -Compress
[System.IO.File]::WriteAllText(${powerShellLiteral(outputPath)}, $json, [System.Text.UTF8Encoding]::new($false))
`;
}

// Windows OCR misses small light-on-dark UI text at 1x (League client: 0 lines at 1x, 32 at 2x),
// so the captured region is enlarged before OCR; line boxes are scaled back in the reader.
const OCR_MAX_SCALED_SIDE = 6000;

function resolveOcrScale(region) {
  const longest = Math.max(region.width, region.height);
  return Math.max(1, Math.min(2, Math.floor((OCR_MAX_SCALED_SIDE / longest) * 4) / 4));
}

// powershell.exe is DPI aware, so CopyFromScreen takes physical (native-screen) pixels.
function createScreenRegionCaptureScript(region, imagePath, outputPath, scale = 1) {
  const scaledWidth = Math.round(region.width * scale);
  const scaledHeight = Math.round(region.height * scale);
  return `
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap ${region.width}, ${region.height}
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen(${region.x}, ${region.y}, 0, 0, $bitmap.Size)
$graphics.Dispose()
if (${scale === 1 ? '$false' : '$true'}) {
  $scaled = New-Object System.Drawing.Bitmap ${scaledWidth}, ${scaledHeight}
  $scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
  $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scaledGraphics.DrawImage($bitmap, 0, 0, ${scaledWidth}, ${scaledHeight})
  $scaledGraphics.Dispose()
  $bitmap.Dispose()
  $bitmap = $scaled
}
$bitmap.Save(${powerShellLiteral(imagePath)}, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
${createScreenTextRecognitionScript(imagePath, outputPath)}`;
}

function normalizeScreenRegion(request) {
  const [x, y, width, height] = [request?.x, request?.y, request?.width, request?.height].map((value) => Math.round(Number(value)));
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0 && width <= 8192 && height <= 8192
    ? { height, width, x, y }
    : null;
}

/**
 * Captures a native-screen rectangle and OCRs it in one PowerShell run (~0.5-1s). Much
 * faster than desktopCapturer, which renders a large thumbnail of every window per call.
 */
function createScreenRegionTextReader({ app, fs, path, runPowerShellScript }) {
  return async function captureRegionText(request) {
    if (process.platform !== 'win32') return { ok: false, reason: 'unsupported-platform', lines: [] };
    const region = normalizeScreenRegion(request);
    if (!region) return { ok: false, reason: 'invalid-region', lines: [] };
    const stem = path.join(app.getPath('temp'), `desktop-pet-region-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
    const imagePath = `${stem}.png`;
    const outputPath = `${stem}.json`;
    try {
      const scale = resolveOcrScale(region);
      await runPowerShellScript(createScreenRegionCaptureScript(region, imagePath, outputPath, scale), { timeout: OCR_TIMEOUT_MS });
      const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      const lines = (Array.isArray(parsed.lines) ? parsed.lines : []).map((line) => ({
        height: line.height / scale, text: line.text, width: line.width / scale, x: line.x / scale, y: line.y / scale,
      }));
      const imageDataUrl = request?.includeImage === true
        ? `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`
        : null;
      return { ok: true, height: region.height, imageDataUrl, language: parsed.language ?? '', lines, width: region.width };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message.slice(0, 300) : String(error), lines: [] };
    } finally {
      fs.rm(imagePath, { force: true }, () => {});
      fs.rm(outputPath, { force: true }, () => {});
    }
  };
}

function decodeImageDataUrl(imageDataUrl) {
  const match = /^data:image\/(png|jpe?g|bmp);base64,(.+)$/i.exec(String(imageDataUrl ?? ''));
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  return { buffer, extension: match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase() };
}

function createScreenTextRecognizer({ app, fs, path, runPowerShellScript }) {
  return async function recognizeScreenText(request) {
    if (process.platform !== 'win32') return { ok: false, reason: 'unsupported-platform', lines: [] };
    const image = decodeImageDataUrl(request?.imageDataUrl);
    if (!image) return { ok: false, reason: 'invalid-image', lines: [] };
    const stem = path.join(app.getPath('temp'), `desktop-pet-ocr-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
    const imagePath = `${stem}.${image.extension}`;
    const outputPath = `${stem}.json`;
    try {
      fs.writeFileSync(imagePath, image.buffer);
      await runPowerShellScript(createScreenTextRecognitionScript(imagePath, outputPath), { timeout: OCR_TIMEOUT_MS });
      const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      return { ok: true, language: parsed.language ?? '', lines: Array.isArray(parsed.lines) ? parsed.lines : [] };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message.slice(0, 300) : String(error), lines: [] };
    } finally {
      fs.rm(imagePath, { force: true }, () => {});
      fs.rm(outputPath, { force: true }, () => {});
    }
  };
}

function registerScreenTextRecognitionIpc({ ipcMain, ...dependencies }) {
  const recognizeScreenText = createScreenTextRecognizer(dependencies);
  ipcMain.handle('desktop-pet:recognize-screen-text', (_event, request) => recognizeScreenText(request));
  const captureRegionText = createScreenRegionTextReader(dependencies);
  ipcMain.handle('desktop-pet:capture-region-text', (_event, request) => captureRegionText(request));
  return recognizeScreenText;
}

module.exports = {
  resolveOcrScale,
  createScreenRegionCaptureScript,
  createScreenRegionTextReader,
  createScreenTextRecognitionScript,
  createScreenTextRecognizer,
  registerScreenTextRecognitionIpc,
};
