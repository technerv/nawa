import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'

export interface CasePackageData {
  reportId: string
  obNumber: string
  crimeName: string
  description?: string
  location: string
  county?: string
  dateCreated: string
  dateUpdated: string
  status: string
  severity: string
  category?: string
  assignedTo?: string
  evidence?: {
    photos?: string[]
    videos?: string[]
    audio?: string[]
  }
  witnesses?: Array<{
    name: string
    contact?: string
    statement?: string
  }>
  auditLog?: Array<{
    timestamp: string
    changedBy?: string
    fromStatus?: string
    toStatus: string
    note?: string
  }>
}

/**
 * Generate OB-compatible PDF for a crime report
 */
export async function generateOBPDF(data: CasePackageData): Promise<Blob> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let yPos = margin

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('OCCURRENCE BOOK (OB) REPORT', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // OB Number
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`OB Number: ${data.obNumber}`, margin, yPos)
  yPos += 8

  // Report ID
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Report ID: ${data.reportId}`, margin, yPos)
  yPos += 8

  // Date Information
  doc.text(`Date Created: ${new Date(data.dateCreated).toLocaleString()}`, margin, yPos)
  yPos += 6
  doc.text(`Last Updated: ${new Date(data.dateUpdated).toLocaleString()}`, margin, yPos)
  yPos += 10

  // Crime Details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('CRIME DETAILS', margin, yPos)
  yPos += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Crime Name: ${data.crimeName}`, margin, yPos)
  yPos += 6

  if (data.category) {
    doc.text(`Category: ${data.category}`, margin, yPos)
    yPos += 6
  }

  doc.text(`Severity: ${data.severity.toUpperCase()}`, margin, yPos)
  yPos += 6
  doc.text(`Status: ${data.status.toUpperCase()}`, margin, yPos)
  yPos += 8

  if (data.description) {
    doc.setFont('helvetica', 'bold')
    doc.text('Description:', margin, yPos)
    yPos += 6
    doc.setFont('helvetica', 'normal')
    const descriptionLines = doc.splitTextToSize(data.description, pageWidth - 2 * margin)
    doc.text(descriptionLines, margin, yPos)
    yPos += descriptionLines.length * 6 + 4
  }

  // Location Details
  doc.setFont('helvetica', 'bold')
  doc.text('LOCATION DETAILS', margin, yPos)
  yPos += 8

  doc.setFont('helvetica', 'normal')
  doc.text(`Location: ${data.location}`, margin, yPos)
  yPos += 6
  if (data.county) {
    doc.text(`County: ${data.county}`, margin, yPos)
    yPos += 6
  }
  yPos += 4

  // Assigned Officer
  if (data.assignedTo) {
    doc.setFont('helvetica', 'bold')
    doc.text('ASSIGNED OFFICER', margin, yPos)
    yPos += 8
    doc.setFont('helvetica', 'normal')
    doc.text(`Officer: ${data.assignedTo}`, margin, yPos)
    yPos += 8
  }

  // Witnesses
  if (data.witnesses && data.witnesses.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.text('WITNESSES', margin, yPos)
    yPos += 8
    doc.setFont('helvetica', 'normal')
    data.witnesses.forEach((witness, idx) => {
      if (yPos > pageHeight - 30) {
        doc.addPage()
        yPos = margin
      }
      doc.text(`${idx + 1}. ${witness.name}`, margin, yPos)
      yPos += 6
      if (witness.contact) {
        doc.text(`   Contact: ${witness.contact}`, margin, yPos)
        yPos += 6
      }
      if (witness.statement) {
        const statementLines = doc.splitTextToSize(`   Statement: ${witness.statement}`, pageWidth - 2 * margin)
        doc.text(statementLines, margin, yPos)
        yPos += statementLines.length * 6
      }
      yPos += 4
    })
  }

  // Audit Log
  if (data.auditLog && data.auditLog.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.text('AUDIT LOG', margin, yPos)
    yPos += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    data.auditLog.forEach((entry) => {
      if (yPos > pageHeight - 20) {
        doc.addPage()
        yPos = margin
      }
      const timestamp = new Date(entry.timestamp).toLocaleString()
      doc.text(`${timestamp}`, margin, yPos)
      yPos += 5
      if (entry.changedBy) {
        doc.text(`Changed by: ${entry.changedBy}`, margin, yPos)
        yPos += 5
      }
      if (entry.fromStatus && entry.toStatus) {
        doc.text(`Status: ${entry.fromStatus} → ${entry.toStatus}`, margin, yPos)
        yPos += 5
      }
      if (entry.note) {
        const noteLines = doc.splitTextToSize(`Note: ${entry.note}`, pageWidth - 2 * margin)
        doc.text(noteLines, margin, yPos)
        yPos += noteLines.length * 5
      }
      yPos += 3
    })
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.text(
      `Page ${i} of ${totalPages} | Generated by NAWA System | ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  return doc.output('blob')
}

/**
 * Download PDF file
 */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate case package (ZIP with PDF and evidence)
 */
export async function generateCasePackage(data: CasePackageData): Promise<void> {
  const zip = new JSZip()
  
  // Generate PDF
  const pdfBlob = await generateOBPDF(data)
  zip.file(`OB-${data.obNumber}.pdf`, pdfBlob)
  
  // Add evidence files if available
  if (data.evidence) {
    const evidenceFolder = zip.folder('evidence')
    if (!evidenceFolder) return
    
    // Add photos
    if (data.evidence.photos && data.evidence.photos.length > 0) {
      const photosFolder = evidenceFolder.folder('photos')
      if (photosFolder) {
        for (let i = 0; i < data.evidence.photos.length; i++) {
          try {
            const photoUrl = data.evidence.photos[i]
            const response = await fetch(photoUrl)
            const blob = await response.blob()
            photosFolder.file(`photo_${i + 1}.${blob.type.split('/')[1] || 'jpg'}`, blob)
          } catch (err) {
            console.error(`Failed to add photo ${i + 1}:`, err)
          }
        }
      }
    }
    
    // Add videos
    if (data.evidence.videos && data.evidence.videos.length > 0) {
      const videosFolder = evidenceFolder.folder('videos')
      if (videosFolder) {
        for (let i = 0; i < data.evidence.videos.length; i++) {
          try {
            const videoUrl = data.evidence.videos[i]
            const response = await fetch(videoUrl)
            const blob = await response.blob()
            videosFolder.file(`video_${i + 1}.${blob.type.split('/')[1] || 'mp4'}`, blob)
          } catch (err) {
            console.error(`Failed to add video ${i + 1}:`, err)
          }
        }
      }
    }
    
    // Add audio
    if (data.evidence.audio && data.evidence.audio.length > 0) {
      const audioFolder = evidenceFolder.folder('audio')
      if (audioFolder) {
        for (let i = 0; i < data.evidence.audio.length; i++) {
          try {
            const audioUrl = data.evidence.audio[i]
            const response = await fetch(audioUrl)
            const blob = await response.blob()
            audioFolder.file(`audio_${i + 1}.${blob.type.split('/')[1] || 'mp3'}`, blob)
          } catch (err) {
            console.error(`Failed to add audio ${i + 1}:`, err)
          }
        }
      }
    }
  }
  
  // Add metadata JSON
  const metadata = {
    report_id: data.reportId,
    ob_number: data.obNumber,
    generated_at: new Date().toISOString(),
    generated_by: 'NAWA System',
    version: '1.0',
  }
  zip.file('metadata.json', JSON.stringify(metadata, null, 2))
  
  // Generate ZIP file
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  
  // Download ZIP
  const url = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `OB-${data.obNumber}-CasePackage-${Date.now()}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

