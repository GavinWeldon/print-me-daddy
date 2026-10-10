import { execFile } from 'child_process'
import type { PrinterFeature } from '../../shared/types'

// Reads and changes a printer's own settings (quality, paper type, borderless, ink…)
// through Windows' Print Schema: the printer describes every setting it supports,
// and choices are saved as the user's printing preferences, exactly like the
// "Printing preferences" window. Works with any brand.

const PSF = 'http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework'

/** Finds the printer (local or network) by name. Shared by both scripts. */
const FIND_QUEUE = `
Add-Type -AssemblyName System.Printing
$server = New-Object System.Printing.LocalPrintServer
$types = @([System.Printing.EnumeratedPrintQueueTypes]::Local, [System.Printing.EnumeratedPrintQueueTypes]::Connections)
$q = $server.GetPrintQueues($types) | Where-Object { $_.FullName -eq $env:PMD_PRINTER -or $_.Name -eq $env:PMD_PRINTER } | Select-Object -First 1
if (-not $q) { throw "Printer not found" }
$psf = '${PSF}'
function Load-Xml($stream) { $d = New-Object System.Xml.XmlDocument; $stream.Position = 0; $d.Load($stream); return $d }
function Ticket-Xml($q) { $t = $q.UserPrintTicket; if (-not $t) { $t = $q.DefaultPrintTicket }; return Load-Xml $t.GetXmlStream() }
`

const READ = `${FIND_QUEUE}
$caps = Load-Xml $q.GetPrintCapabilitiesAsXml()
$ticket = Ticket-Xml $q
$ns = New-Object System.Xml.XmlNamespaceManager($caps.NameTable); $ns.AddNamespace('psf', $psf)
$tns = New-Object System.Xml.XmlNamespaceManager($ticket.NameTable); $tns.AddNamespace('psf', $psf)
$out = foreach ($f in $caps.SelectNodes('/psf:PrintCapabilities/psf:Feature', $ns)) {
  $name = $f.GetAttribute('name')
  $options = @(foreach ($o in $f.SelectNodes('psf:Option', $ns)) {
    if ($o.GetAttribute('name')) { @{ name = $o.GetAttribute('name'); label = "" + $o.SelectSingleNode("psf:Property[@name='psf:DisplayName']/psf:Value", $ns).InnerText } }
  })
  $current = $ticket.SelectSingleNode("/psf:PrintTicket/psf:Feature[@name='$name']/psf:Option", $tns)
  @{ name = $name; label = "" + $f.SelectSingleNode("psf:Property[@name='psf:DisplayName']/psf:Value", $ns).InnerText; options = $options; current = $(if ($current) { $current.GetAttribute('name') } else { '' }) }
}
ConvertTo-Json -InputObject @($out) -Depth 5 -Compress
`

const WRITE = `${FIND_QUEUE}
$caps = Load-Xml $q.GetPrintCapabilitiesAsXml()
$doc = New-Object System.Xml.XmlDocument
$root = $doc.CreateElement('psf', 'PrintTicket', $psf)
$root.SetAttribute('version', '1')
# Reuse the printer's own namespace prefixes so names like "ns0000:PageStamp" mean the same thing.
foreach ($a in $caps.DocumentElement.Attributes) { if ($a.Name -like 'xmlns:*' -and $a.Name -ne 'xmlns:psf') { $root.SetAttribute($a.Name, $a.Value) } }
[void]$doc.AppendChild($root)
$feature = $doc.CreateElement('psf', 'Feature', $psf); $feature.SetAttribute('name', $env:PMD_FEATURE)
$option = $doc.CreateElement('psf', 'Option', $psf); $option.SetAttribute('name', $env:PMD_OPTION)
[void]$feature.AppendChild($option); [void]$root.AppendChild($feature)
$ms = New-Object System.IO.MemoryStream; $doc.Save($ms); $ms.Position = 0
$change = New-Object System.Printing.PrintTicket($ms)
$base = $q.UserPrintTicket; if (-not $base) { $base = $q.DefaultPrintTicket }
$result = $q.MergeAndValidatePrintTicket($base, $change)
$q.UserPrintTicket = $result.ValidatedPrintTicket
$q.Commit()
# Report what the printer actually kept (it may adjust related settings).
$ticket = Ticket-Xml $q
$tns = New-Object System.Xml.XmlNamespaceManager($ticket.NameTable); $tns.AddNamespace('psf', $psf)
$now = $ticket.SelectSingleNode("/psf:PrintTicket/psf:Feature[@name='$env:PMD_FEATURE']/psf:Option", $tns)
if ($now) { $now.GetAttribute('name') } else { '' }
`

function runPowerShell(script: string, env: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, env: { ...process.env, ...env }, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => (err ? reject(new Error(stderr.split('\n')[0] || err.message)) : resolve(stdout.trim()))
    )
  })
}

// ---------- Friendly names ----------

/** Settings Print Me Daddy already controls per job, so they're left to its own options. */
const HANDLED_BY_APP = new Set([
  'psk:PageOutputColor',
  'psk:JobDuplexAllDocumentsContiguously',
  'psk:DocumentDuplex',
  'psk:PageMediaSize',
  'psk:PageOrientation',
  'psk:JobNUpAllDocumentsContiguously',
  'psk:DocumentNUp',
  'psk:PageScaling',
  'psk:JobCopiesAllDocuments'
])

const FEATURE_LABELS: Record<string, string> = {
  PageMediaType: 'Paper type',
  PageOutputQuality: 'Print quality',
  JobInputBin: 'Paper source',
  PageInputBin: 'Paper source',
  DocumentInputBin: 'Paper source',
  PageResolution: 'Resolution',
  PageBorderless: 'Borderless',
  PageCartridge: 'Ink cartridges',
  PageInkToUse: 'Ink to use',
  PageHalftone: 'Halftoning',
  PageColorCorrection: 'Colour correction',
  PageColorManagement: 'Colour management',
  PageICMRenderingIntent: 'Colour rendering',
  PageDestinationColorProfile: 'Colour profile source',
  PagePoster: 'Poster printing',
  JobBooklet: 'Booklet',
  JobBindAllDocuments: 'Stapling side',
  JobPageOrder: 'Page order',
  DocumentCollate: 'Collate copies',
  JobPreview: 'Preview before printing',
  PageStamp: 'Stamp',
  PageReduceSpoolSize: 'Reduce spool size',
  PageDestinationColorProfileURIType: 'Colour profile',
  PageOutputMediaSize: 'Output paper size',
  PageKeepMediaSize: 'Keep paper size',
  PageRotate90Left: 'Rotate 90° left',
  PageRotate180: 'Rotate 180°',
  JobHoldApplicationRotate90: 'Keep the app’s rotation',
  JobNUpBorder: 'Border round each page (per sheet)',
  PageForbidJpegThrough: 'Turn off JPEG pass-through',
  PageOperationOfICCProfileType: 'ICC profile handling',
  PageBorderlessExpandLevel: 'Borderless overhang',
  PageStampLayerMode: 'Stamp layer',
  PageStampPageMode: 'Stamp pages'
}

/** The everyday ones, shown first. */
const COMMON = ['PageOutputQuality', 'PageMediaType', 'PageBorderless', 'JobInputBin', 'PageInputBin', 'PageCartridge', 'PageInkToUse', 'JobPageOrder', 'DocumentCollate']

const OPTION_LABELS: Record<string, string> = {
  OFF: 'Off',
  ON: 'On',
  None: 'None',
  Automatic: 'Automatic',
  Plain: 'Plain paper',
  Borderless: 'Borderless',
  Standard: 'Standard',
  Reverse: 'Reverse (last page first)',
  Collated: 'Collated (1,2,3, 1,2,3)',
  Uncollated: 'Uncollated (1,1, 2,2, 3,3)',
  Black: 'Black only',
  BlackAndColor: 'Black and colour',
  InkToUseBk: 'Black only',
  InkToUseBkColor: 'Black and colour',
  AutoSheetFeeder: 'Rear tray (auto feed)'
}

/** "ns0000:PhotoPaperPlusGlossy2" → "Photo Paper Plus Glossy 2" */
function humanise(qname: string): string {
  return qname
    .replace(/^[\w]+:/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z]{2,})([A-Z0-9])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function featureLabel(name: string, given: string): string {
  const local = name.replace(/^[\w]+:/, '')
  if (FEATURE_LABELS[local]) return FEATURE_LABELS[local]
  if (given.trim()) return given.trim()
  const words = humanise(local).replace(/^(Page|Job|Document) /, '')
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}

function optionLabel(name: string, given: string): string {
  if (given.trim()) return given.trim()
  const local = name.replace(/^[\w]+:/, '')
  if (OPTION_LABELS[local]) return OPTION_LABELS[local]
  const iso = local.match(/^ISO([ABC]\d+)$/)
  if (iso) return iso[1]
  const northAmerica = local.match(/^NorthAmerica(.+)$/)
  if (northAmerica) return humanise(northAmerica[1])
  const division = local.match(/^Division_?(.+)$/)
  if (division) return `${division[1].replace('X', '×')} pages`
  if (local === 'Icm') return 'ICM'
  if (local === 'AdobeRGB1998') return 'Adobe RGB (1998)'
  return humanise(local)
}

// ---------- Public API ----------

const cache = new Map<string, PrinterFeature[]>()

/** Every changeable setting the printer has (one choice only, or already handled by the app, are left out). */
export async function readPrinterFeatures(printer: string, refresh = false): Promise<PrinterFeature[]> {
  if (!refresh && cache.has(printer)) return cache.get(printer)!
  const raw = JSON.parse((await runPowerShell(READ, { PMD_PRINTER: printer })) || '[]') as {
    name: string
    label: string
    current: string
    options: { name: string; label: string }[] | { name: string; label: string }
  }[]
  const features = raw
    .map((f) => ({ ...f, options: Array.isArray(f.options) ? f.options : f.options ? [f.options] : [] }))
    .filter((f) => f.options.length > 1 && !HANDLED_BY_APP.has(f.name))
    .map<PrinterFeature>((f) => ({
      name: f.name,
      label: featureLabel(f.name, f.label),
      common: COMMON.includes(f.name.replace(/^[\w]+:/, '')),
      current: f.current,
      options: f.options.map((o) => ({ name: o.name, label: optionLabel(o.name, o.label) }))
    }))
    .sort((a, b) => Number(b.common) - Number(a.common) || (a.common ? COMMON.indexOf(a.name.replace(/^[\w]+:/, '')) - COMMON.indexOf(b.name.replace(/^[\w]+:/, '')) : a.label.localeCompare(b.label)))
  cache.set(printer, features)
  return features
}

/** Saves one setting as the printer's preference. Returns the option the printer actually kept. */
export async function writePrinterFeature(printer: string, feature: string, option: string): Promise<string> {
  const kept = await runPowerShell(WRITE, { PMD_PRINTER: printer, PMD_FEATURE: feature, PMD_OPTION: option })
  const list = cache.get(printer)
  // Other settings may change too (e.g. borderless can change the paper type), so read fresh next time.
  if (list) cache.delete(printer)
  return kept
}
