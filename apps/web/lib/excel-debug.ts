/**
 * DIAGNOSTIC ONLY — paste this in the browser console or run via ts-node
 * to see exactly what SheetJS reads from the Excel file.
 * 
 * Usage: import this function and call it from a button click in the upload modal.
 */
export async function debugExcel(file: File): Promise<void> {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    console.group('[DEBUG EXCEL]');
    console.log('Sheets:', workbook.SheetNames);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    console.log('Sheet range:', sheet['!ref']);

    // Print merged cells
    const merges = sheet['!merges'] || [];
    console.log('Merges:', merges.slice(0, 20));

    // Print first 20 rows raw=false (formatted)
    const rowsF = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false });
    console.log('=== raw:false (formatted) first 20 rows ===');
    rowsF.slice(0, 20).forEach((r, i) => console.log(`Row ${i}:`, JSON.stringify(r)));

    // Print first 20 rows raw=true (numbers)
    const rowsT = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: true });
    console.log('=== raw:true (numeric) first 20 rows ===');
    rowsT.slice(0, 20).forEach((r, i) => console.log(`Row ${i}:`, JSON.stringify(r)));

    console.groupEnd();
}
