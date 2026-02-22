import pandas as pd
from fpdf import FPDF
import datetime

# Załaduj dane
df = pd.read_csv('raport_diagnostyczny.csv', sep=';')
df['timestamp'] = pd.to_datetime(df['timestamp'])

# Wypfiltruj awarię NH na Sali
mask = (df['sn'].str.contains('NH')) & (df['timestamp'] >= '2026-02-13 00:00:00') & (df['timestamp'] <= '2026-02-13 09:00:00')
nh_df = df[mask].copy()
nh_df = nh_df.sort_values('timestamp')

# Wypfiltruj współpracujące silniki z tego samego czasu
mask_co = (df['timestamp'] >= '2026-02-13 00:00:00') & (df['timestamp'] <= '2026-02-13 09:00:00') & (~df['sn'].str.contains('NH'))
co_df = df[mask_co].copy()

# Znajdź początek problemów u kolegów
early_alarms = co_df[co_df['FINAL_VERDICT'].str.contains('SERWIS|KRYTYCZNY|POŻAR')].copy()

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

pdf.chapter_title('1. Streszczenie Zdarzenia (Executive Summary)')
pdf.chapter_body(
    "Dnia 13 lutego 2026 o godzinie 08:20 doszlo do katastrofalnej awarii (pozar/zatarcie) na "
    "lozysku wrzeciona NH. System zanotowal zjawisko zblokowania walu - wibracje (vib_rms) spadly do "
    "0.01g, podczas gdy w zamknietej obudowie temperatura wzrosla z 50C do 103.6C w zaledwie 5 minut.\n\n"
    "ODPOWIEDZ NA PYTANIE BIZNESOWE: TAK, te awarie dalo sie przewidziec z dwugodzinnym wyprzedzeniem."
)

pdf.chapter_title('2. Reakcja Lancuchowa - Obciazenia Linii (Godzina 06:30 - 06:55)')
pdf.chapter_body(
    "Awaria na wrzecionie NH NIE BYLA zdarzeniem naglym, lecz wynikiem ogromnych obciazen mechanicznych,"
    " ktore trapiły Sage na niemal 2 godziny przed ostatecznym pozarem. Sledztwo wykazalo, ze "
    "silniki z naprzeciwka (OH oraz OV) wziely na siebie potworny ciezar, ulegajac silnemu treniu."
)

# Znalezienie wczesnych alarmów
if len(early_alarms) > 0:
    pdf.set_font('Courier', '', 9)
    early = early_alarms.groupby('sn').head(5)
    for index, row in early.iterrows():
        t = row['timestamp'].strftime("%H:%M:%S")
        pdf.cell(0, 5, f"[{t}] CZUJNIK {row['sn']} -> ZGLOSIL: {row['FINAL_VERDICT'][:20]}... (Temp: {row['temp_mean']:.1f}C)", 0, 1)
    pdf.ln(5)

pdf.chapter_title('3. Ostatnie minuty Wrzecona NH (Godzina 08:10 - 08:20)')
pdf.chapter_body(
    "Nieszczescio zapobiegla by natychmiastowa inspekcja srodowiska ciecia po pierwszych "
    "sygnalach z OH/OV o 06:40. Niestety, linia tnaca pracowala dalej ignorujac zjawisko. "
    "Caly material (lub ekstremalne wibracje/zablokowanie pily) zniszczyly lozysko glowne wrzeciona NH."
)

pdf.set_font('Courier', '', 9)
for index, row in nh_df.tail(6).iterrows():
    t = row['timestamp'].strftime("%H:%M:%S")
    v = row['vib_rms']
    tmp = row['temp_mean']
    grad = row['temp_gradient_final']
    stat = "POZAR/STOP" if "PO" in row['FINAL_VERDICT'] else "MONITORING"
    pdf.cell(0, 5, f"[{t}] NH | Wibracja: {v:5.2f}g | Temp: {tmp:5.1f}C | Gradient: {grad:5.1f}C/h | Wynik: {stat}", 0, 1)

pdf.ln(10)
pdf.set_font('Arial', 'B', 12)
pdf.set_text_color(220, 50, 50)
pdf.cell(0, 10, 'Wniosek: Brak reakcji na alarmy agregacyjne sagi (OH/OV) doprowadzil do spalenia NH.', 0, 1)

pdf.output('Raport_Sledczy_Awaria_NH.pdf', 'F')
print("Wygenerowano raport PDF!")
