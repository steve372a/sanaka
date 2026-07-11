#include "qemu/osdep.h"
#include "exec/gdbstub.h"

const GDBFeature gdb_static_features[] = {
    {
        .xmlname = "i386-64bit.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2010-2017 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!-- x86_64 64bit -->\n"
            "\n"
            "<!DOCTYPE target SYSTEM \"gdb-target.dtd\">\n"
            "\n"
            "<feature name=\"org.gnu.gdb.i386.core\">\n"
            "  <flags id=\"x64_eflags\" size=\"4\">\n"
            "\011<field name=\"\" start=\"22\" end=\"31\"/>\n"
            "\011<field name=\"ID\" start=\"21\" end=\"21\"/>\n"
            "\011<field name=\"VIP\" start=\"20\" end=\"20\"/>\n"
            "\011<field name=\"VIF\" start=\"19\" end=\"19\"/>\n"
            "\011<field name=\"AC\" start=\"18\" end=\"18\"/>\n"
            "\011<field name=\"VM\" start=\"17\" end=\"17\"/>\n"
            "\011<field name=\"RF\" start=\"16\" end=\"16\"/>\n"
            "\011<field name=\"\" start=\"15\" end=\"15\"/>\n"
            "\011<field name=\"NT\" start=\"14\" end=\"14\"/>\n"
            "\011<field name=\"IOPL\" start=\"12\" end=\"13\"/>\n"
            "\011<field name=\"OF\" start=\"11\" end=\"11\"/>\n"
            "\011<field name=\"DF\" start=\"10\" end=\"10\"/>\n"
            "\011<field name=\"IF\" start=\"9\" end=\"9\"/>\n"
            "\011<field name=\"TF\" start=\"8\" end=\"8\"/>\n"
            "\011<field name=\"SF\" start=\"7\" end=\"7\"/>\n"
            "\011<field name=\"ZF\" start=\"6\" end=\"6\"/>\n"
            "\011<field name=\"\" start=\"5\" end=\"5\"/>\n"
            "\011<field name=\"AF\" start=\"4\" end=\"4\"/>\n"
            "\011<field name=\"\" start=\"3\" end=\"3\"/>\n"
            "\011<field name=\"PF\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"CF\" start=\"0\" end=\"0\"/>\n"
            "  </flags>\n"
            "\n"
            "  <!-- General registers -->\n"
            "\n"
            "  <reg name=\"rax\" bitsize=\"64\" type=\"int64\" regnum=\"0\"/>\n"
            "  <reg name=\"rbx\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"rcx\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"rdx\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"rsi\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"rdi\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"rbp\" bitsize=\"64\" type=\"data_ptr\"/>\n"
            "  <reg name=\"rsp\" bitsize=\"64\" type=\"data_ptr\"/>\n"
            "  <reg name=\"r8\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r9\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r10\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r11\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r12\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r13\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r14\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r15\" bitsize=\"64\" type=\"int64\"/>\n"
            "\n"
            "  <reg name=\"rip\" bitsize=\"64\" type=\"code_ptr\"/>\n"
            "  <reg name=\"eflags\" bitsize=\"32\" type=\"x64_eflags\"/>\n"
            "\n"
            "  <!-- Segment registers -->\n"
            "\n"
            "  <reg name=\"cs\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"ss\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"ds\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"es\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"fs\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"gs\" bitsize=\"32\" type=\"int32\"/>\n"
            "\n"
            "  <!-- Segment descriptor caches and TLS base MSRs -->\n"
            "\n"
            "  <!--reg name=\"cs_base\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"ss_base\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"ds_base\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"es_base\" bitsize=\"64\" type=\"int64\"/-->\n"
            "  <reg name=\"fs_base\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"gs_base\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"k_gs_base\" bitsize=\"64\" type=\"int64\"/>\n"
            "\n"
            "  <!-- Control registers -->\n"
            "\n"
            "  <flags id=\"x64_cr0\" size=\"8\">\n"
            "\011<field name=\"PG\" start=\"31\" end=\"31\"/>\n"
            "\011<field name=\"CD\" start=\"30\" end=\"30\"/>\n"
            "\011<field name=\"NW\" start=\"29\" end=\"29\"/>\n"
            "\011<field name=\"AM\" start=\"18\" end=\"18\"/>\n"
            "\011<field name=\"WP\" start=\"16\" end=\"16\"/>\n"
            "\011<field name=\"NE\" start=\"5\" end=\"5\"/>\n"
            "\011<field name=\"ET\" start=\"4\" end=\"4\"/>\n"
            "\011<field name=\"TS\" start=\"3\" end=\"3\"/>\n"
            "\011<field name=\"EM\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"MP\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"PE\" start=\"0\" end=\"0\"/>\n"
            "  </flags>\n"
            "\n"
            "  <flags id=\"x64_cr3\" size=\"8\">\n"
            "\011<field name=\"PDBR\" start=\"12\" end=\"63\"/>\n"
            "\011<!--field name=\"\" start=\"3\" end=\"11\"/>\n"
            "\011<field name=\"WT\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"CD\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"\" start=\"0\" end=\"0\"/-->\n"
            "\011<field name=\"PCID\" start=\"0\" end=\"11\"/>\n"
            "  </flags>\n"
            "\n"
            "  <flags id=\"x64_cr4\" size=\"8\">\n"
            "\011<field name=\"PKE\" start=\"22\" end=\"22\"/>\n"
            "\011<field name=\"SMAP\" start=\"21\" end=\"21\"/>\n"
            "\011<field name=\"SMEP\" start=\"20\" end=\"20\"/>\n"
            "\011<field name=\"OSXSAVE\" start=\"18\" end=\"18\"/>\n"
            "\011<field name=\"PCIDE\" start=\"17\" end=\"17\"/>\n"
            "\011<field name=\"FSGSBASE\" start=\"16\" end=\"16\"/>\n"
            "\011<field name=\"SMXE\" start=\"14\" end=\"14\"/>\n"
            "\011<field name=\"VMXE\" start=\"13\" end=\"13\"/>\n"
            "\011<field name=\"LA57\" start=\"12\" end=\"12\"/>\n"
            "\011<field name=\"UMIP\" start=\"11\" end=\"11\"/>\n"
            "\011<field name=\"OSXMMEXCPT\" start=\"10\" end=\"10\"/>\n"
            "\011<field name=\"OSFXSR\" start=\"9\" end=\"9\"/>\n"
            "\011<field name=\"PCE\" start=\"8\" end=\"8\"/>\n"
            "\011<field name=\"PGE\" start=\"7\" end=\"7\"/>\n"
            "\011<field name=\"MCE\" start=\"6\" end=\"6\"/>\n"
            "\011<field name=\"PAE\" start=\"5\" end=\"5\"/>\n"
            "\011<field name=\"PSE\" start=\"4\" end=\"4\"/>\n"
            "\011<field name=\"DE\" start=\"3\" end=\"3\"/>\n"
            "\011<field name=\"TSD\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"PVI\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"VME\" start=\"0\" end=\"0\"/>\n"
            "  </flags>\n"
            "\n"
            "  <flags id=\"x64_efer\" size=\"8\">\n"
            "\011<field name=\"TCE\" start=\"15\" end=\"15\"/>\n"
            "\011<field name=\"FFXSR\" start=\"14\" end=\"14\"/>\n"
            "\011<field name=\"LMSLE\" start=\"13\" end=\"13\"/>\n"
            "\011<field name=\"SVME\" start=\"12\" end=\"12\"/>\n"
            "\011<field name=\"NXE\" start=\"11\" end=\"11\"/>\n"
            "\011<field name=\"LMA\" start=\"10\" end=\"10\"/>\n"
            "\011<field name=\"LME\" start=\"8\" end=\"8\"/>\n"
            "\011<field name=\"SCE\" start=\"0\" end=\"0\"/>\n"
            "  </flags>\n"
            "\n"
            "  <reg name=\"cr0\" bitsize=\"64\" type=\"x64_cr0\"/>\n"
            "  <reg name=\"cr2\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"cr3\" bitsize=\"64\" type=\"x64_cr3\"/>\n"
            "  <reg name=\"cr4\" bitsize=\"64\" type=\"x64_cr4\"/>\n"
            "  <reg name=\"cr8\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"efer\" bitsize=\"64\" type=\"x64_efer\"/>\n"
            "\n"
            "  <!-- x87 FPU -->\n"
            "\n"
            "  <reg name=\"st0\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st1\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st2\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st3\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st4\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st5\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st6\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st7\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "\n"
            "  <reg name=\"fctrl\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fstat\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"ftag\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fiseg\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fioff\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"foseg\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fooff\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fop\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "\n"
            "  <vector id=\"v4f\" type=\"ieee_single\" count=\"4\"/>\n"
            "  <vector id=\"v2d\" type=\"ieee_double\" count=\"2\"/>\n"
            "  <vector id=\"v16i8\" type=\"int8\" count=\"16\"/>\n"
            "  <vector id=\"v8i16\" type=\"int16\" count=\"8\"/>\n"
            "  <vector id=\"v4i32\" type=\"int32\" count=\"4\"/>\n"
            "  <vector id=\"v2i64\" type=\"int64\" count=\"2\"/>\n"
            "  <union id=\"vec128\">\n"
            "\011<field name=\"v4_float\" type=\"v4f\"/>\n"
            "\011<field name=\"v2_double\" type=\"v2d\"/>\n"
            "\011<field name=\"v16_int8\" type=\"v16i8\"/>\n"
            "\011<field name=\"v8_int16\" type=\"v8i16\"/>\n"
            "\011<field name=\"v4_int32\" type=\"v4i32\"/>\n"
            "\011<field name=\"v2_int64\" type=\"v2i64\"/>\n"
            "\011<field name=\"uint128\" type=\"uint128\"/>\n"
            "  </union>\n"
            "  <flags id=\"x64_mxcsr\" size=\"4\">\n"
            "\011<field name=\"IE\" start=\"0\" end=\"0\"/>\n"
            "\011<field name=\"DE\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"ZE\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"OE\" start=\"3\" end=\"3\"/>\n"
            "\011<field name=\"UE\" start=\"4\" end=\"4\"/>\n"
            "\011<field name=\"PE\" start=\"5\" end=\"5\"/>\n"
            "\011<field name=\"DAZ\" start=\"6\" end=\"6\"/>\n"
            "\011<field name=\"IM\" start=\"7\" end=\"7\"/>\n"
            "\011<field name=\"DM\" start=\"8\" end=\"8\"/>\n"
            "\011<field name=\"ZM\" start=\"9\" end=\"9\"/>\n"
            "\011<field name=\"OM\" start=\"10\" end=\"10\"/>\n"
            "\011<field name=\"UM\" start=\"11\" end=\"11\"/>\n"
            "\011<field name=\"PM\" start=\"12\" end=\"12\"/>\n"
            "\011<field name=\"FZ\" start=\"15\" end=\"15\"/>\n"
            "  </flags>\n"
            "\n"
            "  <reg name=\"xmm0\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm1\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm2\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm3\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm4\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm5\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm6\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm7\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm8\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm9\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm10\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm11\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm12\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm13\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm14\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm15\" bitsize=\"128\" type=\"vec128\"/>\n"
            "\n"
            "  <reg name=\"mxcsr\" bitsize=\"32\" type=\"x64_mxcsr\" group=\"vector\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.i386.core",
        .regs = (const char * const [66]) {
            [0] =
                "rax",
            [1] =
                "rbx",
            [2] =
                "rcx",
            [3] =
                "rdx",
            [4] =
                "rsi",
            [5] =
                "rdi",
            [6] =
                "rbp",
            [7] =
                "rsp",
            [8] =
                "r8",
            [9] =
                "r9",
            [10] =
                "r10",
            [11] =
                "r11",
            [12] =
                "r12",
            [13] =
                "r13",
            [14] =
                "r14",
            [15] =
                "r15",
            [16] =
                "rip",
            [17] =
                "eflags",
            [18] =
                "cs",
            [19] =
                "ss",
            [20] =
                "ds",
            [21] =
                "es",
            [22] =
                "fs",
            [23] =
                "gs",
            [24] =
                "fs_base",
            [25] =
                "gs_base",
            [26] =
                "k_gs_base",
            [27] =
                "cr0",
            [28] =
                "cr2",
            [29] =
                "cr3",
            [30] =
                "cr4",
            [31] =
                "cr8",
            [32] =
                "efer",
            [33] =
                "st0",
            [34] =
                "st1",
            [35] =
                "st2",
            [36] =
                "st3",
            [37] =
                "st4",
            [38] =
                "st5",
            [39] =
                "st6",
            [40] =
                "st7",
            [41] =
                "fctrl",
            [42] =
                "fstat",
            [43] =
                "ftag",
            [44] =
                "fiseg",
            [45] =
                "fioff",
            [46] =
                "foseg",
            [47] =
                "fooff",
            [48] =
                "fop",
            [49] =
                "xmm0",
            [50] =
                "xmm1",
            [51] =
                "xmm2",
            [52] =
                "xmm3",
            [53] =
                "xmm4",
            [54] =
                "xmm5",
            [55] =
                "xmm6",
            [56] =
                "xmm7",
            [57] =
                "xmm8",
            [58] =
                "xmm9",
            [59] =
                "xmm10",
            [60] =
                "xmm11",
            [61] =
                "xmm12",
            [62] =
                "xmm13",
            [63] =
                "xmm14",
            [64] =
                "xmm15",
            [65] =
                "mxcsr",
        },
        .base_reg = 0,
        .num_regs = 66,
    },
    {
        .xmlname = "i386-64bit-apx.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2024 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.i386.apx\">\n"
            "  <reg name=\"r16\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r17\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r18\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r19\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r20\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r21\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r22\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r23\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r24\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r25\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r26\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r27\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r28\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r29\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r30\" bitsize=\"64\" type=\"int64\"/>\n"
            "  <reg name=\"r31\" bitsize=\"64\" type=\"int64\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.i386.apx",
        .regs = (const char * const [16]) {
            [0] =
                "r16",
            [1] =
                "r17",
            [2] =
                "r18",
            [3] =
                "r19",
            [4] =
                "r20",
            [5] =
                "r21",
            [6] =
                "r22",
            [7] =
                "r23",
            [8] =
                "r24",
            [9] =
                "r25",
            [10] =
                "r26",
            [11] =
                "r27",
            [12] =
                "r28",
            [13] =
                "r29",
            [14] =
                "r30",
            [15] =
                "r31",
        },
        .base_reg = 0,
        .num_regs = 16,
    },
    {
        .xmlname = "i386-32bit.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2010-2017 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!-- I386 with SSE -->\n"
            "\n"
            "<!DOCTYPE target SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.i386.core\">\n"
            "  <flags id=\"i386_eflags\" size=\"4\">\n"
            "\011<field name=\"\" start=\"22\" end=\"31\"/>\n"
            "\011<field name=\"ID\" start=\"21\" end=\"21\"/>\n"
            "\011<field name=\"VIP\" start=\"20\" end=\"20\"/>\n"
            "\011<field name=\"VIF\" start=\"19\" end=\"19\"/>\n"
            "\011<field name=\"AC\" start=\"18\" end=\"18\"/>\n"
            "\011<field name=\"VM\" start=\"17\" end=\"17\"/>\n"
            "\011<field name=\"RF\" start=\"16\" end=\"16\"/>\n"
            "\011<field name=\"\" start=\"15\" end=\"15\"/>\n"
            "\011<field name=\"NT\" start=\"14\" end=\"14\"/>\n"
            "\011<field name=\"IOPL\" start=\"12\" end=\"13\"/>\n"
            "\011<field name=\"OF\" start=\"11\" end=\"11\"/>\n"
            "\011<field name=\"DF\" start=\"10\" end=\"10\"/>\n"
            "\011<field name=\"IF\" start=\"9\" end=\"9\"/>\n"
            "\011<field name=\"TF\" start=\"8\" end=\"8\"/>\n"
            "\011<field name=\"SF\" start=\"7\" end=\"7\"/>\n"
            "\011<field name=\"ZF\" start=\"6\" end=\"6\"/>\n"
            "\011<field name=\"\" start=\"5\" end=\"5\"/>\n"
            "\011<field name=\"AF\" start=\"4\" end=\"4\"/>\n"
            "\011<field name=\"\" start=\"3\" end=\"3\"/>\n"
            "\011<field name=\"PF\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"CF\" start=\"0\" end=\"0\"/>\n"
            "  </flags>\n"
            "\n"
            "  <reg name=\"eax\" bitsize=\"32\" type=\"int32\" regnum=\"0\"/>\n"
            "  <reg name=\"ecx\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"edx\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"ebx\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"esp\" bitsize=\"32\" type=\"data_ptr\"/>\n"
            "  <reg name=\"ebp\" bitsize=\"32\" type=\"data_ptr\"/>\n"
            "  <reg name=\"esi\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"edi\" bitsize=\"32\" type=\"int32\"/>\n"
            "\n"
            "  <reg name=\"eip\" bitsize=\"32\" type=\"code_ptr\"/>\n"
            "  <reg name=\"eflags\" bitsize=\"32\" type=\"i386_eflags\"/>\n"
            "\n"
            "  <reg name=\"cs\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"ss\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"ds\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"es\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"fs\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"gs\" bitsize=\"32\" type=\"int32\"/>\n"
            "\n"
            "  <!-- Segment descriptor caches and TLS base MSRs -->\n"
            "\n"
            "  <!--reg name=\"cs_base\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"ss_base\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"ds_base\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"es_base\" bitsize=\"32\" type=\"int32\"/-->\n"
            "  <reg name=\"fs_base\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"gs_base\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"k_gs_base\" bitsize=\"32\" type=\"int32\"/>\n"
            "\n"
            "  <flags id=\"i386_cr0\" size=\"4\">\n"
            "\011<field name=\"PG\" start=\"31\" end=\"31\"/>\n"
            "\011<field name=\"CD\" start=\"30\" end=\"30\"/>\n"
            "\011<field name=\"NW\" start=\"29\" end=\"29\"/>\n"
            "\011<field name=\"AM\" start=\"18\" end=\"18\"/>\n"
            "\011<field name=\"WP\" start=\"16\" end=\"16\"/>\n"
            "\011<field name=\"NE\" start=\"5\" end=\"5\"/>\n"
            "\011<field name=\"ET\" start=\"4\" end=\"4\"/>\n"
            "\011<field name=\"TS\" start=\"3\" end=\"3\"/>\n"
            "\011<field name=\"EM\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"MP\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"PE\" start=\"0\" end=\"0\"/>\n"
            "  </flags>\n"
            "\n"
            "  <flags id=\"i386_cr3\" size=\"4\">\n"
            "\011<field name=\"PDBR\" start=\"12\" end=\"31\"/>\n"
            "\011<!--field name=\"\" start=\"3\" end=\"11\"/>\n"
            "\011<field name=\"WT\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"CD\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"\" start=\"0\" end=\"0\"/-->\n"
            "\011<field name=\"PCID\" start=\"0\" end=\"11\"/>\n"
            "  </flags>\n"
            "\n"
            "  <flags id=\"i386_cr4\" size=\"4\">\n"
            "\011<field name=\"VME\" start=\"0\" end=\"0\"/>\n"
            "\011<field name=\"PVI\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"TSD\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"DE\" start=\"3\" end=\"3\"/>\n"
            "\011<field name=\"PSE\" start=\"4\" end=\"4\"/>\n"
            "\011<field name=\"PAE\" start=\"5\" end=\"5\"/>\n"
            "\011<field name=\"MCE\" start=\"6\" end=\"6\"/>\n"
            "\011<field name=\"PGE\" start=\"7\" end=\"7\"/>\n"
            "\011<field name=\"PCE\" start=\"8\" end=\"8\"/>\n"
            "\011<field name=\"OSFXSR\" start=\"9\" end=\"9\"/>\n"
            "\011<field name=\"OSXMMEXCPT\" start=\"10\" end=\"10\"/>\n"
            "\011<field name=\"UMIP\" start=\"11\" end=\"11\"/>\n"
            "\011<field name=\"LA57\" start=\"12\" end=\"12\"/>\n"
            "\011<field name=\"VMXE\" start=\"13\" end=\"13\"/>\n"
            "\011<field name=\"SMXE\" start=\"14\" end=\"14\"/>\n"
            "\011<field name=\"FSGSBASE\" start=\"16\" end=\"16\"/>\n"
            "\011<field name=\"PCIDE\" start=\"17\" end=\"17\"/>\n"
            "\011<field name=\"OSXSAVE\" start=\"18\" end=\"18\"/>\n"
            "\011<field name=\"SMEP\" start=\"20\" end=\"20\"/>\n"
            "\011<field name=\"SMAP\" start=\"21\" end=\"21\"/>\n"
            "\011<field name=\"PKE\" start=\"22\" end=\"22\"/>\n"
            "  </flags>\n"
            "\n"
            "  <flags id=\"i386_efer\" size=\"4\">\n"
            "\011<field name=\"TCE\" start=\"15\" end=\"15\"/>\n"
            "\011<field name=\"FFXSR\" start=\"14\" end=\"14\"/>\n"
            "\011<field name=\"LMSLE\" start=\"13\" end=\"13\"/>\n"
            "\011<field name=\"SVME\" start=\"12\" end=\"12\"/>\n"
            "\011<field name=\"NXE\" start=\"11\" end=\"11\"/>\n"
            "\011<field name=\"LMA\" start=\"10\" end=\"10\"/>\n"
            "\011<field name=\"LME\" start=\"8\" end=\"8\"/>\n"
            "\011<field name=\"SCE\" start=\"0\" end=\"0\"/>\n"
            "  </flags>\n"
            "\n"
            "  <reg name=\"cr0\" bitsize=\"32\" type=\"i386_cr0\"/>\n"
            "  <reg name=\"cr2\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"cr3\" bitsize=\"32\" type=\"i386_cr3\"/>\n"
            "  <reg name=\"cr4\" bitsize=\"32\" type=\"i386_cr4\"/>\n"
            "  <reg name=\"cr8\" bitsize=\"32\" type=\"int32\"/>\n"
            "  <reg name=\"efer\" bitsize=\"32\" type=\"i386_efer\"/>\n"
            "\n"
            "  <reg name=\"st0\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st1\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st2\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st3\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st4\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st5\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st6\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "  <reg name=\"st7\" bitsize=\"80\" type=\"i387_ext\"/>\n"
            "\n"
            "  <reg name=\"fctrl\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fstat\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"ftag\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fiseg\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fioff\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"foseg\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fooff\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fop\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "<!--/feature>\n"
            "<feature name=\"org.gnu.gdb.i386.32bit.sse\"-->\n"
            "  <vector id=\"v4f\" type=\"ieee_single\" count=\"4\"/>\n"
            "  <vector id=\"v2d\" type=\"ieee_double\" count=\"2\"/>\n"
            "  <vector id=\"v16i8\" type=\"int8\" count=\"16\"/>\n"
            "  <vector id=\"v8i16\" type=\"int16\" count=\"8\"/>\n"
            "  <vector id=\"v4i32\" type=\"int32\" count=\"4\"/>\n"
            "  <vector id=\"v2i64\" type=\"int64\" count=\"2\"/>\n"
            "  <union id=\"vec128\">\n"
            "\011<field name=\"v4_float\" type=\"v4f\"/>\n"
            "\011<field name=\"v2_double\" type=\"v2d\"/>\n"
            "\011<field name=\"v16_int8\" type=\"v16i8\"/>\n"
            "\011<field name=\"v8_int16\" type=\"v8i16\"/>\n"
            "\011<field name=\"v4_int32\" type=\"v4i32\"/>\n"
            "\011<field name=\"v2_int64\" type=\"v2i64\"/>\n"
            "\011<field name=\"uint128\" type=\"uint128\"/>\n"
            "  </union>\n"
            "  <flags id=\"i386_mxcsr\" size=\"4\">\n"
            "\011<field name=\"IE\" start=\"0\" end=\"0\"/>\n"
            "\011<field name=\"DE\" start=\"1\" end=\"1\"/>\n"
            "\011<field name=\"ZE\" start=\"2\" end=\"2\"/>\n"
            "\011<field name=\"OE\" start=\"3\" end=\"3\"/>\n"
            "\011<field name=\"UE\" start=\"4\" end=\"4\"/>\n"
            "\011<field name=\"PE\" start=\"5\" end=\"5\"/>\n"
            "\011<field name=\"DAZ\" start=\"6\" end=\"6\"/>\n"
            "\011<field name=\"IM\" start=\"7\" end=\"7\"/>\n"
            "\011<field name=\"DM\" start=\"8\" end=\"8\"/>\n"
            "\011<field name=\"ZM\" start=\"9\" end=\"9\"/>\n"
            "\011<field name=\"OM\" start=\"10\" end=\"10\"/>\n"
            "\011<field name=\"UM\" start=\"11\" end=\"11\"/>\n"
            "\011<field name=\"PM\" start=\"12\" end=\"12\"/>\n"
            "\011<field name=\"FZ\" start=\"15\" end=\"15\"/>\n"
            "  </flags>\n"
            "\n"
            "  <reg name=\"xmm0\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm1\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm2\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm3\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm4\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm5\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm6\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"xmm7\" bitsize=\"128\" type=\"vec128\"/>\n"
            "\n"
            "  <reg name=\"mxcsr\" bitsize=\"32\" type=\"i386_mxcsr\" group=\"vector\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.i386.core",
        .regs = (const char * const [50]) {
            [0] =
                "eax",
            [1] =
                "ecx",
            [2] =
                "edx",
            [3] =
                "ebx",
            [4] =
                "esp",
            [5] =
                "ebp",
            [6] =
                "esi",
            [7] =
                "edi",
            [8] =
                "eip",
            [9] =
                "eflags",
            [10] =
                "cs",
            [11] =
                "ss",
            [12] =
                "ds",
            [13] =
                "es",
            [14] =
                "fs",
            [15] =
                "gs",
            [16] =
                "fs_base",
            [17] =
                "gs_base",
            [18] =
                "k_gs_base",
            [19] =
                "cr0",
            [20] =
                "cr2",
            [21] =
                "cr3",
            [22] =
                "cr4",
            [23] =
                "cr8",
            [24] =
                "efer",
            [25] =
                "st0",
            [26] =
                "st1",
            [27] =
                "st2",
            [28] =
                "st3",
            [29] =
                "st4",
            [30] =
                "st5",
            [31] =
                "st6",
            [32] =
                "st7",
            [33] =
                "fctrl",
            [34] =
                "fstat",
            [35] =
                "ftag",
            [36] =
                "fiseg",
            [37] =
                "fioff",
            [38] =
                "foseg",
            [39] =
                "fooff",
            [40] =
                "fop",
            [41] =
                "xmm0",
            [42] =
                "xmm1",
            [43] =
                "xmm2",
            [44] =
                "xmm3",
            [45] =
                "xmm4",
            [46] =
                "xmm5",
            [47] =
                "xmm6",
            [48] =
                "xmm7",
            [49] =
                "mxcsr",
        },
        .base_reg = 0,
        .num_regs = 50,
    },
    {
        .xmlname = "aarch64-core.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2009-2025 Free Software Foundation, Inc.\n"
            "     Contributed by ARM Ltd.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.aarch64.core\">\n"
            "  <reg name=\"x0\" bitsize=\"64\"/>\n"
            "  <reg name=\"x1\" bitsize=\"64\"/>\n"
            "  <reg name=\"x2\" bitsize=\"64\"/>\n"
            "  <reg name=\"x3\" bitsize=\"64\"/>\n"
            "  <reg name=\"x4\" bitsize=\"64\"/>\n"
            "  <reg name=\"x5\" bitsize=\"64\"/>\n"
            "  <reg name=\"x6\" bitsize=\"64\"/>\n"
            "  <reg name=\"x7\" bitsize=\"64\"/>\n"
            "  <reg name=\"x8\" bitsize=\"64\"/>\n"
            "  <reg name=\"x9\" bitsize=\"64\"/>\n"
            "  <reg name=\"x10\" bitsize=\"64\"/>\n"
            "  <reg name=\"x11\" bitsize=\"64\"/>\n"
            "  <reg name=\"x12\" bitsize=\"64\"/>\n"
            "  <reg name=\"x13\" bitsize=\"64\"/>\n"
            "  <reg name=\"x14\" bitsize=\"64\"/>\n"
            "  <reg name=\"x15\" bitsize=\"64\"/>\n"
            "  <reg name=\"x16\" bitsize=\"64\"/>\n"
            "  <reg name=\"x17\" bitsize=\"64\"/>\n"
            "  <reg name=\"x18\" bitsize=\"64\"/>\n"
            "  <reg name=\"x19\" bitsize=\"64\"/>\n"
            "  <reg name=\"x20\" bitsize=\"64\"/>\n"
            "  <reg name=\"x21\" bitsize=\"64\"/>\n"
            "  <reg name=\"x22\" bitsize=\"64\"/>\n"
            "  <reg name=\"x23\" bitsize=\"64\"/>\n"
            "  <reg name=\"x24\" bitsize=\"64\"/>\n"
            "  <reg name=\"x25\" bitsize=\"64\"/>\n"
            "  <reg name=\"x26\" bitsize=\"64\"/>\n"
            "  <reg name=\"x27\" bitsize=\"64\"/>\n"
            "  <reg name=\"x28\" bitsize=\"64\"/>\n"
            "  <reg name=\"x29\" bitsize=\"64\"/>\n"
            "  <reg name=\"x30\" bitsize=\"64\"/>\n"
            "  <reg name=\"sp\" bitsize=\"64\" type=\"data_ptr\"/>\n"
            "\n"
            "  <reg name=\"pc\" bitsize=\"64\" type=\"code_ptr\"/>\n"
            "\n"
            "  <flags id=\"cpsr_flags\" size=\"4\">\n"
            "    <!-- Stack Pointer.  -->\n"
            "    <field name=\"SP\" start=\"0\" end=\"0\"/>\n"
            "\n"
            "    <!-- Exception Level.  -->\n"
            "    <field name=\"EL\" start=\"2\" end=\"3\"/>\n"
            "    <!-- Execution state.  -->\n"
            "    <field name=\"nRW\" start=\"4\" end=\"4\"/>\n"
            "\n"
            "    <!-- FIQ interrupt mask.  -->\n"
            "    <field name=\"F\" start=\"6\" end=\"6\"/>\n"
            "    <!-- IRQ interrupt mask.  -->\n"
            "    <field name=\"I\" start=\"7\" end=\"7\"/>\n"
            "    <!-- SError interrupt mask.  -->\n"
            "    <field name=\"A\" start=\"8\" end=\"8\"/>\n"
            "    <!-- Debug exception mask.  -->\n"
            "    <field name=\"D\" start=\"9\" end=\"9\"/>\n"
            "\n"
            "    <!-- ARMv8.5-A: Branch Target Identification BTYPE.  -->\n"
            "    <field name=\"BTYPE\" start=\"10\" end=\"11\"/>\n"
            "\n"
            "    <!-- ARMv8.0-A: Speculative Store Bypass.  -->\n"
            "    <field name=\"SSBS\" start=\"12\" end=\"12\"/>\n"
            "\n"
            "    <!-- Illegal Execution state.  -->\n"
            "    <field name=\"IL\" start=\"20\" end=\"20\"/>\n"
            "    <!-- Software Step.  -->\n"
            "    <field name=\"SS\" start=\"21\" end=\"21\"/>\n"
            "    <!-- ARMv8.1-A: Privileged Access Never.  -->\n"
            "    <field name=\"PAN\" start=\"22\" end=\"22\"/>\n"
            "    <!-- ARMv8.2-A: User Access Override.  -->\n"
            "    <field name=\"UAO\" start=\"23\" end=\"23\"/>\n"
            "    <!-- ARMv8.4-A: Data Independent Timing.  -->\n"
            "    <field name=\"DIT\" start=\"24\" end=\"24\"/>\n"
            "    <!-- ARMv8.5-A: Tag Check Override.  -->\n"
            "    <field name=\"TCO\" start=\"25\" end=\"25\"/>\n"
            "\n"
            "    <!-- Overflow Condition flag.  -->\n"
            "    <field name=\"V\" start=\"28\" end=\"28\"/>\n"
            "    <!-- Carry Condition flag.  -->\n"
            "    <field name=\"C\" start=\"29\" end=\"29\"/>\n"
            "    <!-- Zero Condition flag.  -->\n"
            "    <field name=\"Z\" start=\"30\" end=\"30\"/>\n"
            "    <!-- Negative Condition flag.  -->\n"
            "    <field name=\"N\" start=\"31\" end=\"31\"/>\n"
            "  </flags>\n"
            "  <reg name=\"cpsr\" bitsize=\"32\" type=\"cpsr_flags\"/>\n"
            "\n"
            "</feature>\n",
        .name = "org.gnu.gdb.aarch64.core",
        .regs = (const char * const [34]) {
            [0] =
                "x0",
            [1] =
                "x1",
            [2] =
                "x2",
            [3] =
                "x3",
            [4] =
                "x4",
            [5] =
                "x5",
            [6] =
                "x6",
            [7] =
                "x7",
            [8] =
                "x8",
            [9] =
                "x9",
            [10] =
                "x10",
            [11] =
                "x11",
            [12] =
                "x12",
            [13] =
                "x13",
            [14] =
                "x14",
            [15] =
                "x15",
            [16] =
                "x16",
            [17] =
                "x17",
            [18] =
                "x18",
            [19] =
                "x19",
            [20] =
                "x20",
            [21] =
                "x21",
            [22] =
                "x22",
            [23] =
                "x23",
            [24] =
                "x24",
            [25] =
                "x25",
            [26] =
                "x26",
            [27] =
                "x27",
            [28] =
                "x28",
            [29] =
                "x29",
            [30] =
                "x30",
            [31] =
                "sp",
            [32] =
                "pc",
            [33] =
                "cpsr",
        },
        .base_reg = 0,
        .num_regs = 34,
    },
    {
        .xmlname = "aarch64-fpu.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2009-2012 Free Software Foundation, Inc.\n"
            "     Contributed by ARM Ltd.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.aarch64.fpu\">\n"
            "  <vector id=\"v2d\" type=\"ieee_double\" count=\"2\"/>\n"
            "  <vector id=\"v2u\" type=\"uint64\" count=\"2\"/>\n"
            "  <vector id=\"v2i\" type=\"int64\" count=\"2\"/>\n"
            "  <vector id=\"v4f\" type=\"ieee_single\" count=\"4\"/>\n"
            "  <vector id=\"v4u\" type=\"uint32\" count=\"4\"/>\n"
            "  <vector id=\"v4i\" type=\"int32\" count=\"4\"/>\n"
            "  <vector id=\"v8u\" type=\"uint16\" count=\"8\"/>\n"
            "  <vector id=\"v8i\" type=\"int16\" count=\"8\"/>\n"
            "  <vector id=\"v16u\" type=\"uint8\" count=\"16\"/>\n"
            "  <vector id=\"v16i\" type=\"int8\" count=\"16\"/>\n"
            "  <vector id=\"v1u\" type=\"uint128\" count=\"1\"/>\n"
            "  <vector id=\"v1i\" type=\"int128\" count=\"1\"/>\n"
            "  <union id=\"vnd\">\n"
            "    <field name=\"f\" type=\"v2d\"/>\n"
            "    <field name=\"u\" type=\"v2u\"/>\n"
            "    <field name=\"s\" type=\"v2i\"/>\n"
            "  </union>\n"
            "  <union id=\"vns\">\n"
            "    <field name=\"f\" type=\"v4f\"/>\n"
            "    <field name=\"u\" type=\"v4u\"/>\n"
            "    <field name=\"s\" type=\"v4i\"/>\n"
            "  </union>\n"
            "  <union id=\"vnh\">\n"
            "    <field name=\"u\" type=\"v8u\"/>\n"
            "    <field name=\"s\" type=\"v8i\"/>\n"
            "  </union>\n"
            "  <union id=\"vnb\">\n"
            "    <field name=\"u\" type=\"v16u\"/>\n"
            "    <field name=\"s\" type=\"v16i\"/>\n"
            "  </union>\n"
            "  <union id=\"vnq\">\n"
            "    <field name=\"u\" type=\"v1u\"/>\n"
            "    <field name=\"s\" type=\"v1i\"/>\n"
            "  </union>\n"
            "  <union id=\"aarch64v\">\n"
            "    <field name=\"d\" type=\"vnd\"/>\n"
            "    <field name=\"s\" type=\"vns\"/>\n"
            "    <field name=\"h\" type=\"vnh\"/>\n"
            "    <field name=\"b\" type=\"vnb\"/>\n"
            "    <field name=\"q\" type=\"vnq\"/>\n"
            "  </union>\n"
            "  <reg name=\"v0\" bitsize=\"128\" type=\"aarch64v\" regnum=\"34\"/>\n"
            "  <reg name=\"v1\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v2\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v3\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v4\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v5\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v6\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v7\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v8\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v9\" bitsize=\"128\" type=\"aarch64v\" />\n"
            "  <reg name=\"v10\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v11\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v12\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v13\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v14\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v15\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v16\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v17\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v18\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v19\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v20\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v21\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v22\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v23\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v24\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v25\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v26\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v27\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v28\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v29\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v30\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"v31\" bitsize=\"128\" type=\"aarch64v\"/>\n"
            "  <reg name=\"fpsr\" bitsize=\"32\"/>\n"
            "  <reg name=\"fpcr\" bitsize=\"32\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.aarch64.fpu",
        .regs = (const char * const [34]) {
            [0] =
                "v0",
            [1] =
                "v1",
            [2] =
                "v2",
            [3] =
                "v3",
            [4] =
                "v4",
            [5] =
                "v5",
            [6] =
                "v6",
            [7] =
                "v7",
            [8] =
                "v8",
            [9] =
                "v9",
            [10] =
                "v10",
            [11] =
                "v11",
            [12] =
                "v12",
            [13] =
                "v13",
            [14] =
                "v14",
            [15] =
                "v15",
            [16] =
                "v16",
            [17] =
                "v17",
            [18] =
                "v18",
            [19] =
                "v19",
            [20] =
                "v20",
            [21] =
                "v21",
            [22] =
                "v22",
            [23] =
                "v23",
            [24] =
                "v24",
            [25] =
                "v25",
            [26] =
                "v26",
            [27] =
                "v27",
            [28] =
                "v28",
            [29] =
                "v29",
            [30] =
                "v30",
            [31] =
                "v31",
            [32] =
                "fpsr",
            [33] =
                "fpcr",
        },
        .base_reg = 34,
        .num_regs = 34,
    },
    {
        .xmlname = "arm-core.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.arm.core\">\n"
            "  <reg name=\"r0\" bitsize=\"32\"/>\n"
            "  <reg name=\"r1\" bitsize=\"32\"/>\n"
            "  <reg name=\"r2\" bitsize=\"32\"/>\n"
            "  <reg name=\"r3\" bitsize=\"32\"/>\n"
            "  <reg name=\"r4\" bitsize=\"32\"/>\n"
            "  <reg name=\"r5\" bitsize=\"32\"/>\n"
            "  <reg name=\"r6\" bitsize=\"32\"/>\n"
            "  <reg name=\"r7\" bitsize=\"32\"/>\n"
            "  <reg name=\"r8\" bitsize=\"32\"/>\n"
            "  <reg name=\"r9\" bitsize=\"32\"/>\n"
            "  <reg name=\"r10\" bitsize=\"32\"/>\n"
            "  <reg name=\"r11\" bitsize=\"32\"/>\n"
            "  <reg name=\"r12\" bitsize=\"32\"/>\n"
            "  <reg name=\"sp\" bitsize=\"32\" type=\"data_ptr\"/>\n"
            "  <reg name=\"lr\" bitsize=\"32\"/>\n"
            "  <reg name=\"pc\" bitsize=\"32\" type=\"code_ptr\"/>\n"
            "\n"
            "  <!-- The CPSR is register 25, rather than register 16, because\n"
            "       the FPA registers historically were placed between the PC\n"
            "       and the CPSR in the \"g\" packet.  -->\n"
            "  <reg name=\"cpsr\" bitsize=\"32\" regnum=\"25\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.arm.core",
        .regs = (const char * const [26]) {
            [0] =
                "r0",
            [1] =
                "r1",
            [2] =
                "r2",
            [3] =
                "r3",
            [4] =
                "r4",
            [5] =
                "r5",
            [6] =
                "r6",
            [7] =
                "r7",
            [8] =
                "r8",
            [9] =
                "r9",
            [10] =
                "r10",
            [11] =
                "r11",
            [12] =
                "r12",
            [13] =
                "sp",
            [14] =
                "lr",
            [15] =
                "pc",
            [25] =
                "cpsr",
        },
        .base_reg = 0,
        .num_regs = 26,
    },
    {
        .xmlname = "arm-vfp.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.arm.vfp\">\n"
            "  <reg name=\"d0\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d1\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d2\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d3\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d4\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d5\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d6\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d7\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d8\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d9\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d10\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d11\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d12\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d13\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d14\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d15\" bitsize=\"64\" type=\"float\"/>\n"
            "\n"
            "  <reg name=\"fpscr\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.arm.vfp",
        .regs = (const char * const [17]) {
            [0] =
                "d0",
            [1] =
                "d1",
            [2] =
                "d2",
            [3] =
                "d3",
            [4] =
                "d4",
            [5] =
                "d5",
            [6] =
                "d6",
            [7] =
                "d7",
            [8] =
                "d8",
            [9] =
                "d9",
            [10] =
                "d10",
            [11] =
                "d11",
            [12] =
                "d12",
            [13] =
                "d13",
            [14] =
                "d14",
            [15] =
                "d15",
            [16] =
                "fpscr",
        },
        .base_reg = 0,
        .num_regs = 17,
    },
    {
        .xmlname = "arm-vfp3.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.arm.vfp\">\n"
            "  <reg name=\"d0\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d1\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d2\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d3\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d4\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d5\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d6\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d7\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d8\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d9\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d10\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d11\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d12\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d13\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d14\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d15\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d16\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d17\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d18\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d19\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d20\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d21\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d22\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d23\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d24\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d25\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d26\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d27\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d28\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d29\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d30\" bitsize=\"64\" type=\"float\"/>\n"
            "  <reg name=\"d31\" bitsize=\"64\" type=\"float\"/>\n"
            "\n"
            "  <reg name=\"fpscr\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.arm.vfp",
        .regs = (const char * const [33]) {
            [0] =
                "d0",
            [1] =
                "d1",
            [2] =
                "d2",
            [3] =
                "d3",
            [4] =
                "d4",
            [5] =
                "d5",
            [6] =
                "d6",
            [7] =
                "d7",
            [8] =
                "d8",
            [9] =
                "d9",
            [10] =
                "d10",
            [11] =
                "d11",
            [12] =
                "d12",
            [13] =
                "d13",
            [14] =
                "d14",
            [15] =
                "d15",
            [16] =
                "d16",
            [17] =
                "d17",
            [18] =
                "d18",
            [19] =
                "d19",
            [20] =
                "d20",
            [21] =
                "d21",
            [22] =
                "d22",
            [23] =
                "d23",
            [24] =
                "d24",
            [25] =
                "d25",
            [26] =
                "d26",
            [27] =
                "d27",
            [28] =
                "d28",
            [29] =
                "d29",
            [30] =
                "d30",
            [31] =
                "d31",
            [32] =
                "fpscr",
        },
        .base_reg = 0,
        .num_regs = 33,
    },
    {
        .xmlname = "arm-vfp-sysregs.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2021 Linaro Ltd.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.\n"
            "\n"
            "     These are A/R profile VFP system registers. Debugger users probably\n"
            "     don't really care about these, but because we used to (incorrectly)\n"
            "     provide them to gdb in the org.gnu.gdb.arm.vfp XML we continue\n"
            "     to do so via this separate XML.\n"
            "     -->\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.qemu.gdb.arm.vfp-sysregs\">\n"
            "  <reg name=\"fpsid\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "  <reg name=\"fpexc\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "</feature>\n",
        .name = "org.qemu.gdb.arm.vfp-sysregs",
        .regs = (const char * const [2]) {
            [0] =
                "fpsid",
            [1] =
                "fpexc",
        },
        .base_reg = 0,
        .num_regs = 2,
    },
    {
        .xmlname = "arm-neon.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.arm.vfp\">\n"
            "  <vector id=\"neon_uint8x8\" type=\"uint8\" count=\"8\"/>\n"
            "  <vector id=\"neon_uint16x4\" type=\"uint16\" count=\"4\"/>\n"
            "  <vector id=\"neon_uint32x2\" type=\"uint32\" count=\"2\"/>\n"
            "  <vector id=\"neon_float32x2\" type=\"ieee_single\" count=\"2\"/>\n"
            "  <union id=\"neon_d\">\n"
            "    <field name=\"u8\" type=\"neon_uint8x8\"/>\n"
            "    <field name=\"u16\" type=\"neon_uint16x4\"/>\n"
            "    <field name=\"u32\" type=\"neon_uint32x2\"/>\n"
            "    <field name=\"u64\" type=\"uint64\"/>\n"
            "    <field name=\"f32\" type=\"neon_float32x2\"/>\n"
            "    <field name=\"f64\" type=\"ieee_double\"/>\n"
            "  </union>\n"
            "  <vector id=\"neon_uint8x16\" type=\"uint8\" count=\"16\"/>\n"
            "  <vector id=\"neon_uint16x8\" type=\"uint16\" count=\"8\"/>\n"
            "  <vector id=\"neon_uint32x4\" type=\"uint32\" count=\"4\"/>\n"
            "  <vector id=\"neon_uint64x2\" type=\"uint64\" count=\"2\"/>\n"
            "  <vector id=\"neon_float32x4\" type=\"ieee_single\" count=\"4\"/>\n"
            "  <vector id=\"neon_float64x2\" type=\"ieee_double\" count=\"2\"/>\n"
            "  <union id=\"neon_q\">\n"
            "    <field name=\"u8\" type=\"neon_uint8x16\"/>\n"
            "    <field name=\"u16\" type=\"neon_uint16x8\"/>\n"
            "    <field name=\"u32\" type=\"neon_uint32x4\"/>\n"
            "    <field name=\"u64\" type=\"neon_uint64x2\"/>\n"
            "    <field name=\"f32\" type=\"neon_float32x4\"/>\n"
            "    <field name=\"f64\" type=\"neon_float64x2\"/>\n"
            "  </union>\n"
            "  <reg name=\"d0\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d1\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d2\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d3\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d4\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d5\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d6\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d7\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d8\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d9\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d10\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d11\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d12\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d13\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d14\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d15\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d16\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d17\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d18\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d19\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d20\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d21\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d22\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d23\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d24\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d25\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d26\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d27\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d28\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d29\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d30\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "  <reg name=\"d31\" bitsize=\"64\" type=\"neon_d\"/>\n"
            "\n"
            "  <reg name=\"q0\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q1\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q2\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q3\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q4\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q5\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q6\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q7\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q8\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q9\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q10\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q11\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q12\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q13\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q14\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "  <reg name=\"q15\" bitsize=\"128\" type=\"neon_q\"/>\n"
            "\n"
            "  <reg name=\"fpscr\" bitsize=\"32\" type=\"int\" group=\"float\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.arm.vfp",
        .regs = (const char * const [49]) {
            [0] =
                "d0",
            [1] =
                "d1",
            [2] =
                "d2",
            [3] =
                "d3",
            [4] =
                "d4",
            [5] =
                "d5",
            [6] =
                "d6",
            [7] =
                "d7",
            [8] =
                "d8",
            [9] =
                "d9",
            [10] =
                "d10",
            [11] =
                "d11",
            [12] =
                "d12",
            [13] =
                "d13",
            [14] =
                "d14",
            [15] =
                "d15",
            [16] =
                "d16",
            [17] =
                "d17",
            [18] =
                "d18",
            [19] =
                "d19",
            [20] =
                "d20",
            [21] =
                "d21",
            [22] =
                "d22",
            [23] =
                "d23",
            [24] =
                "d24",
            [25] =
                "d25",
            [26] =
                "d26",
            [27] =
                "d27",
            [28] =
                "d28",
            [29] =
                "d29",
            [30] =
                "d30",
            [31] =
                "d31",
            [32] =
                "q0",
            [33] =
                "q1",
            [34] =
                "q2",
            [35] =
                "q3",
            [36] =
                "q4",
            [37] =
                "q5",
            [38] =
                "q6",
            [39] =
                "q7",
            [40] =
                "q8",
            [41] =
                "q9",
            [42] =
                "q10",
            [43] =
                "q11",
            [44] =
                "q12",
            [45] =
                "q13",
            [46] =
                "q14",
            [47] =
                "q15",
            [48] =
                "fpscr",
        },
        .base_reg = 0,
        .num_regs = 49,
    },
    {
        .xmlname = "arm-m-profile.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2010-2020 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.arm.m-profile\">\n"
            "  <reg name=\"r0\" bitsize=\"32\"/>\n"
            "  <reg name=\"r1\" bitsize=\"32\"/>\n"
            "  <reg name=\"r2\" bitsize=\"32\"/>\n"
            "  <reg name=\"r3\" bitsize=\"32\"/>\n"
            "  <reg name=\"r4\" bitsize=\"32\"/>\n"
            "  <reg name=\"r5\" bitsize=\"32\"/>\n"
            "  <reg name=\"r6\" bitsize=\"32\"/>\n"
            "  <reg name=\"r7\" bitsize=\"32\"/>\n"
            "  <reg name=\"r8\" bitsize=\"32\"/>\n"
            "  <reg name=\"r9\" bitsize=\"32\"/>\n"
            "  <reg name=\"r10\" bitsize=\"32\"/>\n"
            "  <reg name=\"r11\" bitsize=\"32\"/>\n"
            "  <reg name=\"r12\" bitsize=\"32\"/>\n"
            "  <reg name=\"sp\" bitsize=\"32\" type=\"data_ptr\"/>\n"
            "  <reg name=\"lr\" bitsize=\"32\"/>\n"
            "  <reg name=\"pc\" bitsize=\"32\" type=\"code_ptr\"/>\n"
            "  <reg name=\"xpsr\" bitsize=\"32\" regnum=\"25\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.arm.m-profile",
        .regs = (const char * const [26]) {
            [0] =
                "r0",
            [1] =
                "r1",
            [2] =
                "r2",
            [3] =
                "r3",
            [4] =
                "r4",
            [5] =
                "r5",
            [6] =
                "r6",
            [7] =
                "r7",
            [8] =
                "r8",
            [9] =
                "r9",
            [10] =
                "r10",
            [11] =
                "r11",
            [12] =
                "r12",
            [13] =
                "sp",
            [14] =
                "lr",
            [15] =
                "pc",
            [25] =
                "xpsr",
        },
        .base_reg = 0,
        .num_regs = 26,
    },
    {
        .xmlname = "arm-m-profile-mve.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2021 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.arm.m-profile-mve\">\n"
            "  <flags id=\"vpr_reg\" size=\"4\">\n"
            "    <!-- ARMv8.1-M and MVE: Unprivileged and privileged Access.  -->\n"
            "    <field name=\"P0\" start=\"0\" end=\"15\"/>\n"
            "    <!-- ARMv8.1-M: Privileged Access only.  -->\n"
            "    <field name=\"MASK01\" start=\"16\" end=\"19\"/>\n"
            "    <!-- ARMv8.1-M: Privileged Access only.  -->\n"
            "    <field name=\"MASK23\" start=\"20\" end=\"23\"/>\n"
            "  </flags>\n"
            "  <reg name=\"vpr\" bitsize=\"32\" type=\"vpr_reg\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.arm.m-profile-mve",
        .regs = (const char * const [1]) {
            [0] =
                "vpr",
        },
        .base_reg = 0,
        .num_regs = 1,
    },
    {
        .xmlname = "aarch64-pauth.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2018-2022 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.aarch64.pauth_v2\">\n"
            "  <reg name=\"pauth_dmask\" bitsize=\"64\"/>\n"
            "  <reg name=\"pauth_cmask\" bitsize=\"64\"/>\n"
            "  <reg name=\"pauth_dmask_high\" bitsize=\"64\"/>\n"
            "  <reg name=\"pauth_cmask_high\" bitsize=\"64\"/>\n"
            "</feature>\n"
            "\n",
        .name = "org.gnu.gdb.aarch64.pauth_v2",
        .regs = (const char * const [4]) {
            [0] =
                "pauth_dmask",
            [1] =
                "pauth_cmask",
            [2] =
                "pauth_dmask_high",
            [3] =
                "pauth_cmask_high",
        },
        .base_reg = 0,
        .num_regs = 4,
    },
    {
        .xmlname = "aarch64-sme2.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2025 Linaro Ltd.\n"
            "\n"
            "     SPDX-License-Identifier: GPL-2.0-or-later\n"
            "\n"
            "     This is the SME2 ZT0 register. Upstream GDB dynamically generates\n"
            "     the XML for this feature, but because the vector is always 64 bytes\n"
            "     in size we prefer to use static XML for it.\n"
            "     -->\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.aarch64.sme2\">\n"
            "  <vector id=\"sme2_bv\" type=\"uint8\" count=\"64\"/>\n"
            "  <reg name=\"zt0\" bitsize=\"512\" type=\"sme2_bv\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.aarch64.sme2",
        .regs = (const char * const [1]) {
            [0] =
                "zt0",
        },
        .base_reg = 0,
        .num_regs = 1,
    },
    {
        .xmlname = "riscv-64bit-cpu.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2018-2019 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.riscv.cpu\">\n"
            "  <reg name=\"zero\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"ra\" bitsize=\"64\" type=\"code_ptr\"/>\n"
            "  <reg name=\"sp\" bitsize=\"64\" type=\"data_ptr\"/>\n"
            "  <reg name=\"gp\" bitsize=\"64\" type=\"data_ptr\"/>\n"
            "  <reg name=\"tp\" bitsize=\"64\" type=\"data_ptr\"/>\n"
            "  <reg name=\"t0\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"t1\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"t2\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"fp\" bitsize=\"64\" type=\"data_ptr\"/>\n"
            "  <reg name=\"s1\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"a0\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"a1\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"a2\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"a3\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"a4\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"a5\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"a6\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"a7\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s2\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s3\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s4\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s5\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s6\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s7\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s8\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s9\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s10\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"s11\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"t3\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"t4\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"t5\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"t6\" bitsize=\"64\" type=\"int\"/>\n"
            "  <reg name=\"pc\" bitsize=\"64\" type=\"code_ptr\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.riscv.cpu",
        .regs = (const char * const [33]) {
            [0] =
                "zero",
            [1] =
                "ra",
            [2] =
                "sp",
            [3] =
                "gp",
            [4] =
                "tp",
            [5] =
                "t0",
            [6] =
                "t1",
            [7] =
                "t2",
            [8] =
                "fp",
            [9] =
                "s1",
            [10] =
                "a0",
            [11] =
                "a1",
            [12] =
                "a2",
            [13] =
                "a3",
            [14] =
                "a4",
            [15] =
                "a5",
            [16] =
                "a6",
            [17] =
                "a7",
            [18] =
                "s2",
            [19] =
                "s3",
            [20] =
                "s4",
            [21] =
                "s5",
            [22] =
                "s6",
            [23] =
                "s7",
            [24] =
                "s8",
            [25] =
                "s9",
            [26] =
                "s10",
            [27] =
                "s11",
            [28] =
                "t3",
            [29] =
                "t4",
            [30] =
                "t5",
            [31] =
                "t6",
            [32] =
                "pc",
        },
        .base_reg = 0,
        .num_regs = 33,
    },
    {
        .xmlname = "riscv-32bit-fpu.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2018-2019 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.riscv.fpu\">\n"
            "  <reg name=\"ft0\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft1\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft2\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft3\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft4\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft5\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft6\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft7\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs0\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs1\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fa0\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fa1\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fa2\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fa3\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fa4\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fa5\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fa6\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fa7\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs2\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs3\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs4\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs5\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs6\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs7\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs8\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs9\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs10\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"fs11\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft8\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft9\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft10\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "  <reg name=\"ft11\" bitsize=\"32\" type=\"ieee_single\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.riscv.fpu",
        .regs = (const char * const [32]) {
            [0] =
                "ft0",
            [1] =
                "ft1",
            [2] =
                "ft2",
            [3] =
                "ft3",
            [4] =
                "ft4",
            [5] =
                "ft5",
            [6] =
                "ft6",
            [7] =
                "ft7",
            [8] =
                "fs0",
            [9] =
                "fs1",
            [10] =
                "fa0",
            [11] =
                "fa1",
            [12] =
                "fa2",
            [13] =
                "fa3",
            [14] =
                "fa4",
            [15] =
                "fa5",
            [16] =
                "fa6",
            [17] =
                "fa7",
            [18] =
                "fs2",
            [19] =
                "fs3",
            [20] =
                "fs4",
            [21] =
                "fs5",
            [22] =
                "fs6",
            [23] =
                "fs7",
            [24] =
                "fs8",
            [25] =
                "fs9",
            [26] =
                "fs10",
            [27] =
                "fs11",
            [28] =
                "ft8",
            [29] =
                "ft9",
            [30] =
                "ft10",
            [31] =
                "ft11",
        },
        .base_reg = 0,
        .num_regs = 32,
    },
    {
        .xmlname = "riscv-64bit-fpu.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2018-2019 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.riscv.fpu\">\n"
            "\n"
            "  <union id=\"riscv_double\">\n"
            "    <field name=\"float\" type=\"ieee_single\"/>\n"
            "    <field name=\"double\" type=\"ieee_double\"/>\n"
            "  </union>\n"
            "\n"
            "  <reg name=\"ft0\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft1\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft2\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft3\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft4\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft5\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft6\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft7\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs0\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs1\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fa0\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fa1\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fa2\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fa3\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fa4\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fa5\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fa6\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fa7\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs2\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs3\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs4\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs5\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs6\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs7\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs8\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs9\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs10\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"fs11\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft8\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft9\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft10\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "  <reg name=\"ft11\" bitsize=\"64\" type=\"riscv_double\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.riscv.fpu",
        .regs = (const char * const [32]) {
            [0] =
                "ft0",
            [1] =
                "ft1",
            [2] =
                "ft2",
            [3] =
                "ft3",
            [4] =
                "ft4",
            [5] =
                "ft5",
            [6] =
                "ft6",
            [7] =
                "ft7",
            [8] =
                "fs0",
            [9] =
                "fs1",
            [10] =
                "fa0",
            [11] =
                "fa1",
            [12] =
                "fa2",
            [13] =
                "fa3",
            [14] =
                "fa4",
            [15] =
                "fa5",
            [16] =
                "fa6",
            [17] =
                "fa7",
            [18] =
                "fs2",
            [19] =
                "fs3",
            [20] =
                "fs4",
            [21] =
                "fs5",
            [22] =
                "fs6",
            [23] =
                "fs7",
            [24] =
                "fs8",
            [25] =
                "fs9",
            [26] =
                "fs10",
            [27] =
                "fs11",
            [28] =
                "ft8",
            [29] =
                "ft9",
            [30] =
                "ft10",
            [31] =
                "ft11",
        },
        .base_reg = 0,
        .num_regs = 32,
    },
    {
        .xmlname = "riscv-64bit-virtual.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2018-2019 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.riscv.virtual\">\n"
            "  <reg name=\"priv\" bitsize=\"64\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.riscv.virtual",
        .regs = (const char * const [1]) {
            [0] =
                "priv",
        },
        .base_reg = 0,
        .num_regs = 1,
    },
    {
        .xmlname = "riscv-32bit-cpu.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2018-2019 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.riscv.cpu\">\n"
            "  <reg name=\"zero\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"ra\" bitsize=\"32\" type=\"code_ptr\"/>\n"
            "  <reg name=\"sp\" bitsize=\"32\" type=\"data_ptr\"/>\n"
            "  <reg name=\"gp\" bitsize=\"32\" type=\"data_ptr\"/>\n"
            "  <reg name=\"tp\" bitsize=\"32\" type=\"data_ptr\"/>\n"
            "  <reg name=\"t0\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"t1\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"t2\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"fp\" bitsize=\"32\" type=\"data_ptr\"/>\n"
            "  <reg name=\"s1\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"a0\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"a1\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"a2\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"a3\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"a4\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"a5\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"a6\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"a7\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s2\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s3\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s4\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s5\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s6\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s7\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s8\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s9\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s10\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"s11\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"t3\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"t4\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"t5\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"t6\" bitsize=\"32\" type=\"int\"/>\n"
            "  <reg name=\"pc\" bitsize=\"32\" type=\"code_ptr\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.riscv.cpu",
        .regs = (const char * const [33]) {
            [0] =
                "zero",
            [1] =
                "ra",
            [2] =
                "sp",
            [3] =
                "gp",
            [4] =
                "tp",
            [5] =
                "t0",
            [6] =
                "t1",
            [7] =
                "t2",
            [8] =
                "fp",
            [9] =
                "s1",
            [10] =
                "a0",
            [11] =
                "a1",
            [12] =
                "a2",
            [13] =
                "a3",
            [14] =
                "a4",
            [15] =
                "a5",
            [16] =
                "a6",
            [17] =
                "a7",
            [18] =
                "s2",
            [19] =
                "s3",
            [20] =
                "s4",
            [21] =
                "s5",
            [22] =
                "s6",
            [23] =
                "s7",
            [24] =
                "s8",
            [25] =
                "s9",
            [26] =
                "s10",
            [27] =
                "s11",
            [28] =
                "t3",
            [29] =
                "t4",
            [30] =
                "t5",
            [31] =
                "t6",
            [32] =
                "pc",
        },
        .base_reg = 0,
        .num_regs = 33,
    },
    {
        .xmlname = "riscv-32bit-virtual.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2018-2019 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.riscv.virtual\">\n"
            "  <reg name=\"priv\" bitsize=\"32\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.riscv.virtual",
        .regs = (const char * const [1]) {
            [0] =
                "priv",
        },
        .base_reg = 0,
        .num_regs = 1,
    },
    {
        .xmlname = "power-core.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2007, 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.power.core\">\n"
            "  <reg name=\"r0\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r1\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r2\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r3\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r4\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r5\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r6\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r7\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r8\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r9\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r10\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r11\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r12\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r13\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r14\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r15\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r16\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r17\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r18\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r19\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r20\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r21\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r22\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r23\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r24\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r25\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r26\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r27\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r28\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r29\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r30\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"r31\" bitsize=\"32\" type=\"uint32\"/>\n"
            "\n"
            "  <reg name=\"pc\" bitsize=\"32\" type=\"code_ptr\" regnum=\"64\"/>\n"
            "  <reg name=\"msr\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"cr\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"lr\" bitsize=\"32\" type=\"code_ptr\"/>\n"
            "  <reg name=\"ctr\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"xer\" bitsize=\"32\" type=\"uint32\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.power.core",
        .regs = (const char * const [70]) {
            [0] =
                "r0",
            [1] =
                "r1",
            [2] =
                "r2",
            [3] =
                "r3",
            [4] =
                "r4",
            [5] =
                "r5",
            [6] =
                "r6",
            [7] =
                "r7",
            [8] =
                "r8",
            [9] =
                "r9",
            [10] =
                "r10",
            [11] =
                "r11",
            [12] =
                "r12",
            [13] =
                "r13",
            [14] =
                "r14",
            [15] =
                "r15",
            [16] =
                "r16",
            [17] =
                "r17",
            [18] =
                "r18",
            [19] =
                "r19",
            [20] =
                "r20",
            [21] =
                "r21",
            [22] =
                "r22",
            [23] =
                "r23",
            [24] =
                "r24",
            [25] =
                "r25",
            [26] =
                "r26",
            [27] =
                "r27",
            [28] =
                "r28",
            [29] =
                "r29",
            [30] =
                "r30",
            [31] =
                "r31",
            [64] =
                "pc",
            [65] =
                "msr",
            [66] =
                "cr",
            [67] =
                "lr",
            [68] =
                "ctr",
            [69] =
                "xer",
        },
        .base_reg = 0,
        .num_regs = 70,
    },
    {
        .xmlname = "power-fpu.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2007, 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.power.fpu\">\n"
            "  <reg name=\"f0\" bitsize=\"64\" type=\"ieee_double\" regnum=\"71\"/>\n"
            "  <reg name=\"f1\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f2\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f3\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f4\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f5\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f6\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f7\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f8\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f9\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f10\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f11\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f12\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f13\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f14\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f15\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f16\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f17\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f18\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f19\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f20\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f21\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f22\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f23\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f24\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f25\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f26\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f27\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f28\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f29\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f30\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "  <reg name=\"f31\" bitsize=\"64\" type=\"ieee_double\"/>\n"
            "\n"
            "  <reg name=\"fpscr\" bitsize=\"32\" group=\"float\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.power.fpu",
        .regs = (const char * const [33]) {
            [0] =
                "f0",
            [1] =
                "f1",
            [2] =
                "f2",
            [3] =
                "f3",
            [4] =
                "f4",
            [5] =
                "f5",
            [6] =
                "f6",
            [7] =
                "f7",
            [8] =
                "f8",
            [9] =
                "f9",
            [10] =
                "f10",
            [11] =
                "f11",
            [12] =
                "f12",
            [13] =
                "f13",
            [14] =
                "f14",
            [15] =
                "f15",
            [16] =
                "f16",
            [17] =
                "f17",
            [18] =
                "f18",
            [19] =
                "f19",
            [20] =
                "f20",
            [21] =
                "f21",
            [22] =
                "f22",
            [23] =
                "f23",
            [24] =
                "f24",
            [25] =
                "f25",
            [26] =
                "f26",
            [27] =
                "f27",
            [28] =
                "f28",
            [29] =
                "f29",
            [30] =
                "f30",
            [31] =
                "f31",
            [32] =
                "fpscr",
        },
        .base_reg = 71,
        .num_regs = 33,
    },
    {
        .xmlname = "power-altivec.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2007, 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.power.altivec\">\n"
            "  <vector id=\"v4f\" type=\"ieee_single\" count=\"4\"/>\n"
            "  <vector id=\"v4i32\" type=\"int32\" count=\"4\"/>\n"
            "  <vector id=\"v8i16\" type=\"int16\" count=\"8\"/>\n"
            "  <vector id=\"v16i8\" type=\"int8\" count=\"16\"/>\n"
            "  <union id=\"vec128\">\n"
            "    <field name=\"uint128\" type=\"uint128\"/>\n"
            "    <field name=\"v4_float\" type=\"v4f\"/>\n"
            "    <field name=\"v4_int32\" type=\"v4i32\"/>\n"
            "    <field name=\"v8_int16\" type=\"v8i16\"/>\n"
            "    <field name=\"v16_int8\" type=\"v16i8\"/>\n"
            "  </union>\n"
            "\n"
            "  <reg name=\"vr0\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr1\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr2\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr3\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr4\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr5\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr6\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr7\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr8\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr9\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr10\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr11\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr12\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr13\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr14\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr15\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr16\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr17\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr18\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr19\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr20\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr21\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr22\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr23\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr24\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr25\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr26\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr27\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr28\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr29\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr30\" bitsize=\"128\" type=\"vec128\"/>\n"
            "  <reg name=\"vr31\" bitsize=\"128\" type=\"vec128\"/>\n"
            "\n"
            "  <reg name=\"vscr\" bitsize=\"32\" group=\"vector\"/>\n"
            "  <reg name=\"vrsave\" bitsize=\"32\" group=\"vector\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.power.altivec",
        .regs = (const char * const [34]) {
            [0] =
                "vr0",
            [1] =
                "vr1",
            [2] =
                "vr2",
            [3] =
                "vr3",
            [4] =
                "vr4",
            [5] =
                "vr5",
            [6] =
                "vr6",
            [7] =
                "vr7",
            [8] =
                "vr8",
            [9] =
                "vr9",
            [10] =
                "vr10",
            [11] =
                "vr11",
            [12] =
                "vr12",
            [13] =
                "vr13",
            [14] =
                "vr14",
            [15] =
                "vr15",
            [16] =
                "vr16",
            [17] =
                "vr17",
            [18] =
                "vr18",
            [19] =
                "vr19",
            [20] =
                "vr20",
            [21] =
                "vr21",
            [22] =
                "vr22",
            [23] =
                "vr23",
            [24] =
                "vr24",
            [25] =
                "vr25",
            [26] =
                "vr26",
            [27] =
                "vr27",
            [28] =
                "vr28",
            [29] =
                "vr29",
            [30] =
                "vr30",
            [31] =
                "vr31",
            [32] =
                "vscr",
            [33] =
                "vrsave",
        },
        .base_reg = 0,
        .num_regs = 34,
    },
    {
        .xmlname = "power-spe.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2007, 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.power.spe\">\n"
            "  <reg name=\"ev0h\" bitsize=\"32\" regnum=\"71\"/>\n"
            "  <reg name=\"ev1h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev2h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev3h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev4h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev5h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev6h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev7h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev8h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev9h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev10h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev11h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev12h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev13h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev14h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev15h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev16h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev17h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev18h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev19h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev20h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev21h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev22h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev23h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev24h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev25h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev26h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev27h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev28h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev29h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev30h\" bitsize=\"32\"/>\n"
            "  <reg name=\"ev31h\" bitsize=\"32\"/>\n"
            "\n"
            "  <reg name=\"acc\" bitsize=\"64\"/>\n"
            "  <reg name=\"spefscr\" bitsize=\"32\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.power.spe",
        .regs = (const char * const [34]) {
            [0] =
                "ev0h",
            [1] =
                "ev1h",
            [2] =
                "ev2h",
            [3] =
                "ev3h",
            [4] =
                "ev4h",
            [5] =
                "ev5h",
            [6] =
                "ev6h",
            [7] =
                "ev7h",
            [8] =
                "ev8h",
            [9] =
                "ev9h",
            [10] =
                "ev10h",
            [11] =
                "ev11h",
            [12] =
                "ev12h",
            [13] =
                "ev13h",
            [14] =
                "ev14h",
            [15] =
                "ev15h",
            [16] =
                "ev16h",
            [17] =
                "ev17h",
            [18] =
                "ev18h",
            [19] =
                "ev19h",
            [20] =
                "ev20h",
            [21] =
                "ev21h",
            [22] =
                "ev22h",
            [23] =
                "ev23h",
            [24] =
                "ev24h",
            [25] =
                "ev25h",
            [26] =
                "ev26h",
            [27] =
                "ev27h",
            [28] =
                "ev28h",
            [29] =
                "ev29h",
            [30] =
                "ev30h",
            [31] =
                "ev31h",
            [32] =
                "acc",
            [33] =
                "spefscr",
        },
        .base_reg = 71,
        .num_regs = 34,
    },
    {
        .xmlname = "power64-core.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2007, 2008 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.power.core\">\n"
            "  <reg name=\"r0\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r1\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r2\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r3\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r4\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r5\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r6\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r7\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r8\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r9\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r10\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r11\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r12\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r13\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r14\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r15\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r16\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r17\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r18\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r19\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r20\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r21\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r22\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r23\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r24\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r25\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r26\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r27\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r28\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r29\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r30\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"r31\" bitsize=\"64\" type=\"uint64\"/>\n"
            "\n"
            "  <reg name=\"pc\" bitsize=\"64\" type=\"code_ptr\" regnum=\"64\"/>\n"
            "  <reg name=\"msr\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"cr\" bitsize=\"32\" type=\"uint32\"/>\n"
            "  <reg name=\"lr\" bitsize=\"64\" type=\"code_ptr\"/>\n"
            "  <reg name=\"ctr\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"xer\" bitsize=\"32\" type=\"uint32\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.power.core",
        .regs = (const char * const [70]) {
            [0] =
                "r0",
            [1] =
                "r1",
            [2] =
                "r2",
            [3] =
                "r3",
            [4] =
                "r4",
            [5] =
                "r5",
            [6] =
                "r6",
            [7] =
                "r7",
            [8] =
                "r8",
            [9] =
                "r9",
            [10] =
                "r10",
            [11] =
                "r11",
            [12] =
                "r12",
            [13] =
                "r13",
            [14] =
                "r14",
            [15] =
                "r15",
            [16] =
                "r16",
            [17] =
                "r17",
            [18] =
                "r18",
            [19] =
                "r19",
            [20] =
                "r20",
            [21] =
                "r21",
            [22] =
                "r22",
            [23] =
                "r23",
            [24] =
                "r24",
            [25] =
                "r25",
            [26] =
                "r26",
            [27] =
                "r27",
            [28] =
                "r28",
            [29] =
                "r29",
            [30] =
                "r30",
            [31] =
                "r31",
            [64] =
                "pc",
            [65] =
                "msr",
            [66] =
                "cr",
            [67] =
                "lr",
            [68] =
                "ctr",
            [69] =
                "xer",
        },
        .base_reg = 0,
        .num_regs = 70,
    },
    {
        .xmlname = "power-vsx.xml",
        .xml = 
            "<?xml version=\"1.0\"?>\n"
            "<!-- Copyright (C) 2008-2015 Free Software Foundation, Inc.\n"
            "\n"
            "     Copying and distribution of this file, with or without modification,\n"
            "     are permitted in any medium without royalty provided the copyright\n"
            "     notice and this notice are preserved.  -->\n"
            "\n"
            "<!-- POWER7 VSX registers that do not overlap existing FP and VMX\n"
            "     registers.  -->\n"
            "<!DOCTYPE feature SYSTEM \"gdb-target.dtd\">\n"
            "<feature name=\"org.gnu.gdb.power.vsx\">\n"
            "  <reg name=\"vs0h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs1h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs2h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs3h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs4h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs5h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs6h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs7h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs8h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs9h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs10h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs11h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs12h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs13h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs14h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs15h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs16h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs17h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs18h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs19h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs20h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs21h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs22h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs23h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs24h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs25h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs26h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs27h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs28h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs29h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs30h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "  <reg name=\"vs31h\" bitsize=\"64\" type=\"uint64\"/>\n"
            "</feature>\n",
        .name = "org.gnu.gdb.power.vsx",
        .regs = (const char * const [32]) {
            [0] =
                "vs0h",
            [1] =
                "vs1h",
            [2] =
                "vs2h",
            [3] =
                "vs3h",
            [4] =
                "vs4h",
            [5] =
                "vs5h",
            [6] =
                "vs6h",
            [7] =
                "vs7h",
            [8] =
                "vs8h",
            [9] =
                "vs9h",
            [10] =
                "vs10h",
            [11] =
                "vs11h",
            [12] =
                "vs12h",
            [13] =
                "vs13h",
            [14] =
                "vs14h",
            [15] =
                "vs15h",
            [16] =
                "vs16h",
            [17] =
                "vs17h",
            [18] =
                "vs18h",
            [19] =
                "vs19h",
            [20] =
                "vs20h",
            [21] =
                "vs21h",
            [22] =
                "vs22h",
            [23] =
                "vs23h",
            [24] =
                "vs24h",
            [25] =
                "vs25h",
            [26] =
                "vs26h",
            [27] =
                "vs27h",
            [28] =
                "vs28h",
            [29] =
                "vs29h",
            [30] =
                "vs30h",
            [31] =
                "vs31h",
        },
        .base_reg = 0,
        .num_regs = 32,
    },
    { NULL }
};
