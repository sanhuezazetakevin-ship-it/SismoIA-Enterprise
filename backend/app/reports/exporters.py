"""Safely encode CSV and on-demand PDF without filesystem writes."""
import csv
import io
import json
from datetime import datetime, timezone
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.graphics.shapes import Drawing, Rect, String


def printable(v):
    if v is None:return ''
    if isinstance(v,(dict,list)):return json.dumps(v,ensure_ascii=False,sort_keys=True)
    if isinstance(v,datetime):return v.isoformat()
    return str(v)

def safe_cell(v):
    s=printable(v)
    # Prevent formula execution when opening CSVs in spreadsheet programs.
    if s.lstrip().startswith(('=','+','-','@','\t','\r','\n')):return "'"+s
    return s

def csv_bytes(headers,rows,metadata):
    stream=io.StringIO(newline='')
    writer=csv.writer(stream,lineterminator='\r\n')
    for key,value in metadata.items():writer.writerow([safe_cell(key),safe_cell(value)])
    writer.writerow([])
    writer.writerow([safe_cell(x) for x in headers])
    for r in rows:writer.writerow([safe_cell(x) for x in r])
    return ('\ufeff'+stream.getvalue()).encode('utf-8')

def pdf_bytes(headers,rows,metadata,summary):
    output=io.BytesIO()
    doc=SimpleDocTemplate(output,pagesize=landscape(A4),leftMargin=35,rightMargin=35,topMargin=40,bottomMargin=40,title='SismoIA | Reporte')
    styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name='SismoBody',parent=styles['Normal'],fontSize=8,leading=11,spaceAfter=5))
    styles.add(ParagraphStyle(name='SismoHead',parent=styles['Heading1'],fontSize=18,textColor=colors.HexColor('#64243e'),spaceAfter=10))
    body=styles['SismoBody']
    story=[Paragraph('SismoIA Enterprise | Reporte operativo',styles['SismoHead'])]
    for k,v in metadata.items():story.append(Paragraph(f'<b>{escape(str(k))}:</b> {escape(printable(v))}',body))
    story.append(Spacer(1,10))
    story.append(Paragraph('<b>Indicadores del conjunto exportado</b>',styles['Heading2']))
    for k,v in summary:story.append(Paragraph(f'{escape(k)}: {escape(v)}',body))
    story.append(Spacer(1,12))
    # Compact visual indicators based strictly on the exported data.
    if rows:
        chart=Drawing(600,100)
        values=[]
        if 'magnitud' in headers:
            idx=headers.index('magnitud')
            mags=[float(row[idx]) for row in rows if row[idx] is not None]
            values=[(f'M {i}-{i+1}',sum(i<=x<i+1 for x in mags)) for i in range(2,8)]
        elif 'estado' in headers:
            idx=headers.index('estado');states=sorted({str(r[idx]) for r in rows})[:6]
            values=[(k,sum(str(r[idx])==k for r in rows)) for k in states]
        elif 'modelo' in headers:
            idx=headers.index('modelo');kinds=sorted({str(r[idx]) for r in rows})[:6]
            values=[(k,sum(str(r[idx])==k for r in rows)) for k in kinds]
        if values:
            top=max((v for _,v in values),default=1) or 1
            width=min(90,560/len(values))
            for i,(label,count) in enumerate(values):
                x=15+i*width;h=65*count/top
                chart.add(Rect(x,17,max(8,width-15),h,strokeColor=None,fillColor=colors.HexColor('#7c3e59')))
                chart.add(String(x,6,label[:14],fontSize=7))
                chart.add(String(x,83,str(count),fontSize=8))
            story.append(Paragraph('<b>Distribución dentro de los registros exportados</b>',body))
            story.append(chart)
    story.append(Spacer(1,12))
    story.append(Paragraph('Registros (muestra de hasta 50 filas; el CSV incluye hasta 1000)',styles['Heading2']))
    # Summarized PDF layout, avoid unreadable 10-column tables.
    selected=list(range(min(5,len(headers))))
    widths=[(A4[1]-70)/max(1,len(selected))]*len(selected)
    data=[[Paragraph(escape(str(headers[i])),body) for i in selected]]
    for row in rows[:50]:
        data.append([Paragraph(escape(printable(row[i])[:130]),body) for i in selected])
    tbl=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    tbl.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e7dce1')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),0.25,colors.HexColor('#d0c9cc')),('BOTTOMPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6)]))
    story.append(tbl)
    story.append(Spacer(1,12))
    story.append(Paragraph('Informacion basada en registros almacenados. No constituye alerta temprana ni prediccion de terremotos.',body))
    doc.build(story)
    return output.getvalue()
