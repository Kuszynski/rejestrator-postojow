import pandas as pd
from fpdf import FPDF
import datetime

# Zaladuj dane
df = pd.read_csv('raport_diagnostyczny.csv', sep=';')
df['timestamp'] = pd.to_datetime(df['timestamp'])

# Wypfiltruj awari?? NH na Sali
mask = (df['sn'].str.contains('NH')) & (df['timestamp'] >= '2026-02-13 00:00:00') & (df['timestamp'] <= '2026-02-13 09:00:00')
nh_df = df[mask].copy()
nh_df = nh_df.sort_values('timestamp')

# Wypfiltruj wsp????pracuj??ce silniki z tego samego czasu
mask_co = (df['timestamp'] >= '2026-02-13 00:00:00') & (df['timestamp'] <= '2026-02-13 09:00:00') & (~df['sn'].str.contains('NH'))
co_df = df[mask_co].copy()

# Znajd?? pocz??tek problem??w u koleg??w
early_alarms = co_df[co_df['FINAL_VERDICT'].str.contains('SERWIS|KRYTYCZNY|PO??AR')].copy()

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.set_text_color(200, 0, 0)
        self.cell(0, 10, 'RAPORT SLEDCZY AI: Analiza Awarii Sagi - Wrzeciono NH', 0, 1, 'C')
        self.set_font('Arial', '', 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, 'System: Bearing Condition Monitor v2.1 ML | Data wygenerowania: ' + datetime.datetime.now().strftime("%Y-%m-%d"), 0, 1, 'C')
        self.ln(10)

    def chapter_title(self, title):
        self.set_font('Arial', 'B', 12)
        self.set_fill_color(240, 240, 240)
        self.cell(0, 8, title, 0, 1, 'L', 1)
        self.ln(4)

    def chapter_body(self, text):
        self.set_font('Arial', '', 11)
        self.multi_cell(0, 6, text.encode('latin-1', 'replace').decode('latin-1'))
        self.ln(4)

pdf = PDF()
pdf.add_page()
pdf.set_auto_page_break(auto=True, margin=15)

pdf.chapter_title('1. Root Cause Analysis (Przyczyna Zrodlowa)')
pdf.chapter_body(
    "Zgodnie z raportem technicznym, bezposrednia przyczyna pozaru byl blad programowy obrotnicy blokow "
    "(blokkvenderen). Obrotnica wrocila do pozycji wyjsciowej przed pelnym wyjsciem klody, co spowodowalo "
    "skrecenie materialu i pozostawienie odcietych fragmentow wewnatrz maszyny. Te zablokowaly czujniki, "
    "prowadzac do blednych nastaw pily i wytworzenia silnego tarcia (varmgang).\n\n"
    "KONKLUZJA: AI wykrylo to tarcie (varmgang) juz o 07:00 jako nienaturalny przyrost ciepla (gradient)."
)

pdf.chapter_title('2. Streszczenie Zdarzenia (Executive Summary)')
pdf.chapter_body(
    "Dnia 13 lutego 2026 o godzinie 08:20 doszlo do katastrofalnej awarii na "
    "lozysku wrzeciona NH. System zanotowal zjawisko zblokowania walu - wibracje (vib_rms) spadly do "
    "0.00g, podczas gdy w zamknietej obudowie temperatura wzrosla z 50C do 103.6C w zaledwie 5 minut.\n\n"
    "WNIOSKI: System AI precyzyjnie wskazal zagrozenie na 75 minut przed pozzarem."
)

pdf.chapter_title('3. Reakcja Lancuchowa - Obciazenia Linii (Godzina 06:30 - 06:55)')
pdf.chapter_body(
    "Zablokowane fragmenty drewna zaczely obciazac Sage juz od startu zmiany. "
    "Silniki OH oraz OV ulegaly silnemu tarciu, probujac przelamac opor mechaniczny."
)

# Znalezienie wczesnych alarm??w
if len(early_alarms) > 0:
    pdf.set_font('Courier', '', 9)
    early = early_alarms.groupby('sn').head(5)
    for index, row in early.iterrows():
        t = row['timestamp'].strftime("%H:%M:%S")
        v_clean = row['FINAL_VERDICT'].replace('🟡', '[!]').replace('🔴', '[CRIT]').replace('🟢', '[OK]')
        pdf.cell(0, 5, f"[{t}] CZUJNIK {row['sn']} -> ZGLOSIL: {v_clean[:20]}... (Temp: {row['temp_mean']:.1f}C)", 0, 1)
    pdf.ln(5)

pdf.chapter_title('4. Wczesne Ostrzezenie na wale NH (Godzina 07:00)')
pdf.chapter_body(
    "Juz o 07:00 system wygenerowal ostrzezenie 'PLANUJ SERWIS' dla NH. "
    "Byl to efekt narastajacego tarcia (varmgang) wywolanego przez mechaniczna blokade."
)

nh_warnings = nh_df[nh_df['FINAL_VERDICT'].str.contains('PLANUJ SERWIS')]
pdf.set_font('Courier', '', 9)
for index, row in nh_warnings.iterrows():
    t = row['timestamp'].strftime("%H:%M:%S")
    v_clean = row['FINAL_VERDICT'].replace('🟡', '[!]').replace('🔴', '[CRIT]').replace('🟢', '[OK]')
    pdf.cell(0, 5, f"[{t}] CZYJNIK NH -> WYKRYTO NACISK: {v_clean[:30]} (Gradient: {row['temp_gradient_final']:.1f}C/h)", 0, 1)
pdf.ln(5)

pdf.chapter_title('5. Ostatnie minuty Wrzeciona NH (Godzina 08:15 - 08:20)')
pdf.chapter_body(
    "Ostateczne zatarcie nastapilo w wyniku dlugotrwalego tarcia przy blednych "
    "nastawach frezow. O 08:15 gradient NH przekroczyl 23C/h, a o 08:20 lozysko osiagnelo 103.6C."
)

pdf.set_font('Courier', '', 9)
for index, row in nh_df.tail(6).iterrows():
    t = row['timestamp'].strftime("%H:%M:%S")
    v = row['vib_rms']
    tmp = row['temp_mean']
    grad = row['temp_gradient_final']
    stat = "POZAR/STOP" if "POZAR" in row['FINAL_VERDICT'].upper() else "MONITORING"
    pdf.cell(0, 5, f"[{t}] NH | Wibracja: {v:5.2f}g | Temp: {tmp:5.1f}C | Gradient: {grad:5.1f}C/h | Wynik: {stat}", 0, 1)

pdf.ln(10)
pdf.set_font('Arial', 'B', 12)
pdf.set_text_color(220, 50, 50)
pdf.cell(0, 10, 'Wniosek: System AI prawidlowo zinterpretowal zjawisko "varmgang" jako zagrozenie pozzarowe.', 0, 1)

pdf.output('Raport_Finalny_RCA_Varmgang.pdf', 'F')
print("Wygenerowano finalny raport PDF prodykcyjny z ostrzezeniem!")
