import pandas as pd

df = pd.read_csv('raport_diagnostyczny.csv', sep=';')
pozary = df[df['FINAL_VERDICT'].str.contains('POŻAR', na=False, case=False)]

print("===== LISTA WYKRYTYCH POŻARÓW NA POSZCZEGÓLNYCH SILNIKACH =====")
for sn, group in pozary.groupby('sn'):
    print(f"\n🔥 SILNIK: {sn}")
    print(group[['timestamp', 'temp_mean', 'temp_gradient_final', 'FINAL_VERDICT']].tail(5).to_string(index=False))

if pozary.empty:
    print("Brak krytycznych alarmów pożarowych.")
