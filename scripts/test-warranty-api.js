const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testWarrantyLookup() {
  console.log('=== Test Warranty Lookup ===\n');

  console.log('1. Lấy 5 warranties mới nhất:');
  const { data: warranties, error: wErr } = await supabase
    .from('warranties')
    .select(`
      id,
      customer_id,
      serial_number_id,
      start_date,
      end_date,
      status,
      customer:customers(id, full_name, phone),
      serial:serial_numbers(id, serial, imei)
    `)
    .order('start_date', { ascending: false })
    .limit(5);

  if (wErr) {
    console.error('Error:', wErr);
    return;
  }

  if (!warranties || warranties.length === 0) {
    console.log('❌ Không có warranty nào trong database\n');
    return;
  }

  console.log(`✓ Tìm thấy ${warranties.length} warranties:\n`);
  warranties.forEach((w, i) => {
    console.log(`[${i + 1}] ID: ${w.id}`);
    console.log(`    Customer: ${w.customer?.full_name || 'null'} - Phone: ${w.customer?.phone || 'null'}`);
    console.log(`    Serial: ${w.serial?.serial || 'null'} - IMEI: ${w.serial?.imei || 'null'}`);
    console.log(`    Status: ${w.status} | ${w.start_date} → ${w.end_date}`);
    console.log('');
  });

  const testPhone = warranties.find(w => w.customer?.phone)?.customer?.phone;
  const testSerial = warranties.find(w => w.serial?.serial)?.serial?.serial;
  const testImei = warranties.find(w => w.serial?.imei)?.serial?.imei;

  if (testPhone) {
    console.log(`\n2. Test tìm theo phone: "${testPhone}"`);
    
    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', testPhone);
    
    console.log(`   → Tìm thấy ${customers?.length || 0} customers`);
    
    if (customers && customers.length > 0) {
      const { data: wByPhone } = await supabase
        .from('warranties')
        .select('id, customer_id, status')
        .in('customer_id', customers.map(c => c.id));
      
      console.log(`   → Tìm thấy ${wByPhone?.length || 0} warranties cho customer này`);
    }
  }

  if (testSerial) {
    console.log(`\n3. Test tìm theo serial: "${testSerial}"`);
    
    const { data: serials } = await supabase
      .from('serial_numbers')
      .select('id')
      .eq('serial', testSerial);
    
    console.log(`   → Tìm thấy ${serials?.length || 0} serial_numbers`);
    
    if (serials && serials.length > 0) {
      const { data: wBySerial } = await supabase
        .from('warranties')
        .select('id, serial_number_id, status')
        .in('serial_number_id', serials.map(s => s.id));
      
      console.log(`   → Tìm thấy ${wBySerial?.length || 0} warranties cho serial này`);
    }
  }

  if (testImei) {
    console.log(`\n4. Test tìm theo IMEI: "${testImei}"`);
    
    const { data: serials } = await supabase
      .from('serial_numbers')
      .select('id')
      .eq('imei', testImei);
    
    console.log(`   → Tìm thấy ${serials?.length || 0} serial_numbers`);
    
    if (serials && serials.length > 0) {
      const { data: wByImei } = await supabase
        .from('warranties')
        .select('id, serial_number_id, status')
        .in('serial_number_id', serials.map(s => s.id));
      
      console.log(`   → Tìm thấy ${wByImei?.length || 0} warranties cho IMEI này`);
    }
  }

  console.log('\n=== Kết thúc test ===');
}

testWarrantyLookup().catch(console.error);
