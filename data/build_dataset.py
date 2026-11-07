import json
V = "2026-11-07"
def c(field, op, value, group=0, fix=None):
    return dict(field=field, op=op, value=value, group_no=group, fixable_by=fix)
INC=lambda v,g=0: c("family_income_inr","<=",v,g,"income_certificate")
MK=lambda v,g=0: c("marks_percent",">=",v,g,"marksheet")
LV=lambda xs,g=0: c("course_level","in",xs,g)
F=lambda g=0: c("gender","in",["female"],g)
S=[]
def add(**k):
    k.setdefault("scope","domestic"); k.setdefault("currency","INR"); k.setdefault("deadline_type","fixed")
    k.setdefault("other",[]); k.setdefault("docs",[]); k.setdefault("verification","secondary"); k.setdefault("note",None)
    S.append(k)

STD_DOCS=["income_certificate","marksheet","bonafide_certificate","bank_details","id_proof","photo"]

add(slug="aicte-pragati-degree", name="AICTE Pragati Scholarship (Technical Degree)", provider="AICTE, Ministry of Education", ptype="government",
    min=50000,max=50000,period="year",deadline="2026-11-30",
    criteria=[F(),LV(["ug"]),c("year_of_study","<=",2),INC(800000)],
    docs=STD_DOCS+["admission_letter"], other=["For first-year students of an AICTE-approved degree programme, or second year via lateral entry","At most two girls per family","Gap after last qualifying exam must not exceed two years"],
    url="https://scholarships.gov.in", sources=["https://scholarships.gov.in/All-Scholarships","https://www.buddy4study.com/article/pragati-scholarship","https://www.wemakescholars.com/other/government-of-india/scholarships"],
    note="NSP lists 30 Nov 2026 after extension. Confirm on scholarships.gov.in.", reopens=6)
add(slug="aicte-pragati-diploma", name="AICTE Pragati Scholarship (Technical Diploma)", provider="AICTE, Ministry of Education", ptype="government",
    min=50000,max=50000,period="year",deadline="2026-11-30",
    criteria=[F(),LV(["diploma"]),c("year_of_study","<=",2),INC(800000)],
    docs=STD_DOCS+["admission_letter"], other=["For first-year students of an AICTE-approved diploma programme, or second year via lateral entry","At most two girls per family"],
    url="https://scholarships.gov.in", sources=["https://scholarships.gov.in/All-Scholarships","https://www.buddy4study.com/article/pragati-scholarship"],
    note="Deadline extended to 30 Nov 2026 per NSP listings. Confirm on scholarships.gov.in.", reopens=6)
add(slug="aicte-saksham", name="AICTE Saksham Scholarship for Specially-Abled Students", provider="AICTE, Ministry of Education", ptype="government",
    min=50000,max=50000,period="year",deadline="2026-11-30",
    criteria=[c("disability","is_true",True,0,"disability_certificate"),LV(["ug","diploma"]),INC(800000)],
    docs=STD_DOCS+["disability_certificate"], other=["Disability of 40% or more","Enrolled in an AICTE-approved technical degree or diploma"],
    url="https://scholarships.gov.in", sources=["https://www.buddy4study.com/article/aicte-scholarships","https://blogs.netasampark.com/post/aicte-pragati-saksham-scholarship-2026-27-apply-nsp-31-october"],
    note="Originally 31 Oct 2026; AICTE schemes on NSP were extended to 30 Nov. Confirm on scholarships.gov.in.", reopens=6)
add(slug="aicte-swanath", name="AICTE Swanath Scholarship (Technical Degree)", provider="AICTE, Ministry of Education", ptype="government",
    min=50000,max=50000,period="year",deadline="2026-11-30",
    criteria=[LV(["ug"]),INC(800000)],
    docs=STD_DOCS, other=["For orphans, children of parents who died of COVID-19, or wards of armed forces / central paramilitary personnel martyred in action","Enrolled in an AICTE-approved technical degree"],
    url="https://scholarships.gov.in", sources=["https://school.careers360.com/articles/nsp-scholarship-last-date-2026-27"], reopens=6)
add(slug="nsp-post-matric-disabilities", name="Post-Matric Scholarship for Students with Disabilities", provider="Dept. of Empowerment of Persons with Disabilities", ptype="government",
    min=None,max=None,coverage="partial",deadline="2026-11-30",
    criteria=[c("disability","is_true",True,0,"disability_certificate"),LV(["school_11_12","diploma","iti","ug","pg"]),INC(250000)],
    docs=STD_DOCS+["disability_certificate"], other=["Disability of 40% or more","Maintenance allowance, disability allowances and fee support as per scheme norms"],
    url="https://scholarships.gov.in", sources=["https://school.careers360.com/articles/nsp-scholarship-last-date-2026-27"], reopens=6)
add(slug="nsp-top-class-disabilities", name="Scholarship for Top Class Education for Students with Disabilities", provider="Dept. of Empowerment of Persons with Disabilities", ptype="government",
    min=None,max=None,coverage="partial",deadline="2026-11-30",
    criteria=[c("disability","is_true",True,0,"disability_certificate"),LV(["ug","pg"]),INC(800000)],
    docs=STD_DOCS+["disability_certificate","admission_letter"], other=["Disability of 40% or more","Admission in a notified top-class institution","Covers fees and allowances as per scheme norms"],
    url="https://scholarships.gov.in", sources=["https://school.careers360.com/articles/nsp-scholarship-last-date-2026-27"], reopens=6)
add(slug="nsp-nfs-st", name="National Fellowship and Scholarship for Higher Education of ST Students", provider="Ministry of Tribal Affairs", ptype="government",
    min=None,max=None,coverage="partial",deadline="2026-11-30",
    criteria=[c("category","in",["ST"],0,"category_certificate"),LV(["ug","pg"])],
    docs=STD_DOCS+["category_certificate","admission_letter"], other=["Admission in a notified top-class institution","Family income limit as per scheme guidelines on NSP"],
    url="https://scholarships.gov.in", sources=["https://school.careers360.com/articles/nsp-scholarship-last-date-2026-27","https://www.msmunify.com/in/central-government-scholarships-blog"], reopens=6)
add(slug="hdfc-parivartan-ecss", name="HDFC Bank Parivartan ECSS Programme", provider="HDFC Bank (Parivartan CSR)", ptype="private",
    min=15000,max=75000,period="year",deadline="2026-12-15",
    criteria=[INC(250000),MK(55),LV(["school_11_12","diploma","iti","ug","pg"])],
    docs=["marksheet","income_certificate","fee_receipt","admission_letter","bank_details","id_proof","photo"], other=["Priority to students facing a personal or family crisis in recent years","Amount depends on level: higher for professional UG and PG courses"],
    url="https://www.buddy4study.com/online-application-form", sources=["https://www.buddy4study.com/online-application-form","https://www.agrijob.in/parivartan-ecss-programme-scholarship-2026-27/"],
    note="Buddy4Study (official partner) lists 15 Dec 2026 after extensions.", reopens=8)
add(slug="kotak-kanya", name="Kotak Kanya Scholarship", provider="Kotak Education Foundation", ptype="private",
    min=150000,max=150000,period="year",deadline="2026-11-15",
    criteria=[F(),LV(["ug"]),c("year_of_study","=",1),MK(75),INC(600000)],
    docs=["marksheet","income_certificate","admission_letter","fee_receipt","bank_details","id_proof","photo"],
    other=["First year of a professional degree (engineering, MBBS, architecture, design, integrated law, etc.) at a NIRF/NAAC-accredited institution","Renewable until graduation at the foundation's discretion"],
    url="https://kotakeducationfoundation.org/kotak-kanya-scholarship", sources=["https://www.buddy4study.com/scholarships","https://university.careers360.com/articles/kotak-kanya-scholarship-2026"],
    note="Buddy4Study lists 15 Nov 2026 for the 2026-27 cycle.", reopens=7)
add(slug="sdef-india", name="SDEF India Scholarship Program", provider="Swami Dayanand Education Foundation", ptype="private",
    min=50000,max=50000,period="year",deadline="2026-11-30",
    criteria=[LV(["ug"]),c("year_of_study","=",1),MK(80),INC(1200000),c("stream","in",["engineering","medical"])],
    docs=["marksheet","income_certificate","admission_letter","fee_receipt","bank_details","id_proof"],
    other=["B.Tech/B.E., MBBS, BDS or B.Arch, full-time first year","No gap year after Class 12","Up to ₹2 lakh over four years, renewable"],
    url="https://www.swamidayanand.org/india-scholarships-2026-27", sources=["https://www.swamidayanand.org/india-scholarships-2026-27","https://news.aglasem.com/sdef-india-scholarship-2026-27/"],
    verification="official", reopens=8)
add(slug="mahindra-saarthi-abhiyaan", name="Mahindra Saarthi Abhiyaan", provider="Mahindra & Mahindra (Truck and Bus)", ptype="private",
    min=10000,max=10000,period="one_time",deadline="2026-11-30",
    criteria=[F(),LV(["school_11_12","diploma","ug","pg"])],
    docs=["marksheet","income_certificate","bank_details","id_proof","photo"], other=["Daughter or ward of a truck driver (proof of the parent's occupation required)"],
    url="https://www.buddy4study.com/online-application-form", sources=["https://morungexpress.com/scholarship-roundup-orober-28-2026-s","https://thehindustangazette.com/education/scholarship/7-major-scholarships-open-for-indian-students-in-2026-27-get-up-to-100-tuition-fee-support-49200"], reopens=10)
add(slug="tata-capital-pankh", name="Tata Capital Pankh Scholarship Programme", provider="Tata Capital", ptype="private",
    min=10000,max=18000,period="year",deadline="2026-11-15",
    criteria=[LV(["school_11_12","diploma","iti","ug"]),MK(60)],
    docs=["marksheet","income_certificate","fee_receipt","bank_details","id_proof","photo"], other=["Up to 80% of tuition fees, capped by level","Family income limit applies (check the portal)","Extra weightage for girls, PwD, single-parent and SC/ST students"],
    url="https://www.buddy4study.com/page/the-tata-capital-pankh-scholarship-programme", sources=["https://www.dtnext.in/news/tamilnadu/dt-next-campus-applications-open-for-tata-capital-pankh-scholarship-programme-2026-27-here-is-how-you-can-apply","https://school.careers360.com/articles/tata-capital-pankh-scholarship-program-2026-27"],
    note="Sources disagree (26 Oct vs 15 Nov 2026). Confirm on Buddy4Study.", reopens=9)
add(slug="sitaram-jindal-foundation", name="Sitaram Jindal Foundation Scholarship", provider="Sitaram Jindal Foundation", ptype="private",
    min=500,max=3200,period="month",deadline=None,deadline_type="rolling",
    criteria=[INC(400000),LV(["school_11_12","iti","diploma","ug","pg"])],
    docs=["marksheet","income_certificate","bonafide_certificate","bank_details","id_proof"], other=["Income limit ₹4 lakh for salaried families, ₹2.5 lakh for others","Minimum marks vary by course category"],
    url="https://www.sitaramjindalfoundation.org", sources=["https://www.agrijob.in/sitaram-jindal-foundation-scholarship-2026-eligibility-apply/","https://www.dtnext.in/news/tamilnadu/dt-next-campus-applications-open-for-sitaram-jindal-foundation-scholarship-scheme-2026-here-is-how-you-can-apply"],
    note="Reported as accepting applications year-round; some listings show a fixed date. Confirm on the foundation website.")
add(slug="aicte-pg-gate", name="AICTE PG Scholarship (GATE / CEED / GPAT)", provider="AICTE, Ministry of Education", ptype="government",
    min=12400,max=12400,period="month",deadline=None,deadline_type="unknown",
    criteria=[LV(["pg"]),c("year_of_study","=",1)],
    docs=["test_score","admission_letter","bank_details","id_proof"], other=["Valid GATE/CEED/GPAT score at the time of admission","Full-time M.E./M.Tech/M.Arch/M.Pharm/M.Des in an AICTE-approved institution","Paid for up to 24 months"],
    url="https://pgscholarship.aicte-india.gov.in", sources=["https://www.buddy4study.com/article/aicte-pg-scholarship","https://engineering.careers360.com/articles/aicte-gate-scholarship"],
    note="Portal usually closes in December; the 2026-27 date was not published when checked.")
add(slug="mahadbt-rajarshi-shahu-ebc", name="Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti (EBC)", provider="Government of Maharashtra (MahaDBT)", ptype="government",
    min=None,max=None,coverage="partial",deadline=None,deadline_type="unknown",
    criteria=[c("state","in",["MH"],0,"domicile_certificate"),INC(800000),LV(["diploma","ug","pg"])],
    docs=["domicile_certificate","income_certificate","marksheet","admission_letter","fee_receipt","bank_details"], other=["Tuition fee reimbursement for students admitted through CAP / government quota","Exact fee share and conditions as per MahaDBT scheme rules"],
    url="https://mahadbt2.maharashtra.gov.in", sources=["https://www.buddy4study.com/article/mahadbt-scholarship"],
    note="2026-27 registration is open on MahaDBT 2.0; the fresh-application deadline had not been announced when checked.")
add(slug="svmcm-west-bengal", name="Swami Vivekananda Merit-cum-Means Scholarship (SVMCM)", provider="Higher Education Dept., Govt. of West Bengal", ptype="government",
    min=1000,max=8000,period="month",deadline=None,deadline_type="unknown",
    criteria=[c("state","in",["WB"],0,"domicile_certificate"),INC(250000),MK(60),LV(["school_11_12","diploma","ug","pg"])],
    docs=["domicile_certificate","income_certificate","marksheet","bank_details","bonafide_certificate"], other=["Must study in an institution in West Bengal","Minimum marks vary by course"],
    url="https://svmcm.wb.gov.in", sources=["https://www.agrijob.in/?p=12074","https://articles.findmycollege.com/news/swami-vivekananda-merit-cum-means-scholarship-svmcm-2026-27-applications-open-at-svmcm-wb-gov-in/"],
    note="Fresh applications usually open in late November; dates for this cycle were not confirmed when checked.", reopens=11)
add(slug="federal-bank-hormis", name="Federal Bank Hormis Memorial Foundation Scholarship", provider="Federal Bank", ptype="private",
    min=None,max=100000,period="year",coverage="partial",deadline=None,deadline_type="unknown",
    criteria=[LV(["ug","pg"]),c("year_of_study","=",1),INC(300000),c("state","in",["AP","GJ","KA","KL","MH","TN","TS"])],
    docs=["marksheet","income_certificate","admission_letter","fee_receipt","bank_details","id_proof"], other=["Professional courses such as MBBS, B.E./B.Tech, Nursing, Agriculture, MBA","Up to 100% tuition reimbursement"],
    url="https://www.federalbank.co.in/corporate-social-responsibility", sources=["https://www.federalbank.co.in/documents/d/guest/federal-bank-hormis-memorial-foundation-scholarships-2025-26-website-announcement-final","https://www.scholarships.net.in/64176.html"],
    note="Last cycle opened in late November and closed 31 Dec 2025. The 2026-27 call was not out yet when checked.", reopens=11)
add(slug="ongc-merit", name="ONGC Merit Scholarship", provider="ONGC Foundation", ptype="private",
    min=48000,max=48000,period="year",deadline="2026-11-30",
    criteria=[c("category","in",["SC","ST"],0,"category_certificate"),INC(450000,0),MK(60,0),c("year_of_study","=",1,0),
              c("category","in",["OBC","EWS","GEN"],1,"category_certificate"),INC(200000,1),MK(60,1),c("year_of_study","=",1,1)],
    docs=["marksheet","income_certificate","category_certificate","admission_letter","bank_details","id_proof"],
    other=["First year of Engineering, MBBS, MBA, or Master's in Geology/Geophysics","Age 30 or below","50% of awards reserved for girls"],
    url="https://ongcscholar.org", sources=["https://www.buddy4study.com/scholarship/ongc-merit-scholarship","https://www.freejobalert.com/articles/ongc-scholarship-2026-27-10478"], reopens=10)
add(slug="reliance-foundation-ug", name="Reliance Foundation Undergraduate Scholarship", provider="Reliance Foundation", ptype="private",
    min=None,max=200000,period="total",deadline="2026-10-05",
    criteria=[LV(["ug"]),c("year_of_study","=",1),MK(60),c("family_income_inr","<",1500000,0,"income_certificate")],
    docs=["marksheet","income_certificate","bonafide_certificate","id_proof"], other=["Preference for family income below ₹2.5 lakh","Mandatory online aptitude test"],
    url="https://scholarships.reliancefoundation.org", sources=["https://school.careers360.com/articles/reliance-foundation-scholarship-2026-27","https://www.agrijob.in/?p=8577"], reopens=8)
add(slug="reliance-foundation-pg", name="Reliance Foundation Postgraduate Scholarship", provider="Reliance Foundation", ptype="private",
    min=None,max=600000,period="total",deadline="2026-10-05",
    criteria=[LV(["pg"]),c("year_of_study","=",1),c("stream","in",["engineering","science","computer_applications"])],
    docs=["marksheet","admission_letter","recommendation_letter","resume","sop"], other=["Fields include computer science, AI, maths, electrical/electronics, chemical and mechanical engineering, renewable energy, materials and life sciences","Selection includes aptitude test and interview"],
    url="https://scholarships.reliancefoundation.org", sources=["https://school.careers360.com/articles/reliance-foundation-scholarship-2026-27"], reopens=8)
add(slug="lic-golden-jubilee", name="LIC Golden Jubilee Scholarship", provider="LIC Golden Jubilee Foundation", ptype="private",
    min=15000,max=50000,period="year",deadline="2026-10-15",
    criteria=[INC(450000),MK(60),LV(["ug","diploma","iti"])],
    docs=["marksheet","income_certificate","admission_letter","bank_details","id_proof"], other=["Selection through LIC divisional offices based on your address"],
    url="https://licindia.in", sources=["https://www.pw.live/news/lic-golden-jubilee-scholarship-2026","https://www.collegechalo.com/scholarship/lic-golden-jubilee-scholarship"], reopens=9)
add(slug="sbi-platinum-jubilee-asha", name="SBI Platinum Jubilee Asha Scholarship", provider="SBI Foundation", ptype="private",
    min=15000,max=2000000,period="year",deadline="2026-09-19",
    criteria=[LV(["school_11_12","ug","pg"]),MK(75),INC(600000)],
    docs=["marksheet","income_certificate","admission_letter","fee_receipt","bank_details","id_proof","photo"], other=["Amount depends on category (school, UG, PG, IIT, IIM, medical, overseas)","Relaxed marks for SC/ST and PwBD applicants","50% of awards reserved for girls"],
    url="https://www.sbiashascholarship.co.in", sources=["https://school.careers360.com/articles/sbi-asha-scholarship-2026-27","https://www.buddy4study.com/article/sbi-asha-scholarship"], reopens=7)
add(slug="csss-pm-usp", name="Central Sector Scheme of Scholarship for College and University Students (PM-USP)", provider="Dept. of Higher Education, Ministry of Education", ptype="government",
    min=12000,max=20000,period="year",deadline="2026-10-31",exclusive="central-govt",
    criteria=[LV(["ug","pg"]),INC(450000)],
    docs=["marksheet","income_certificate","bonafide_certificate","bank_details","id_proof"], other=["Above the 80th percentile in your Class 12 board","Not for distance or diploma courses","Cannot be combined with other government scholarships"],
    url="https://scholarships.gov.in", sources=["https://indianpaycalculator.in/sarkari-result/scholarship/csss-college-scholarship-2026","https://www.msmunify.com/in/central-government-scholarships-blog"],
    note="For 2026-27 the NSP listing was open for renewals only.", reopens=6)
add(slug="sc-top-class-education", name="Central Sector Scholarship of Top Class Education for SC Students", provider="Dept. of Social Justice and Empowerment", ptype="government",
    min=None,max=None,coverage="partial",deadline="2026-10-31",exclusive="central-govt",
    criteria=[c("category","in",["SC"],0,"category_certificate"),INC(800000),LV(["ug","pg"])],
    docs=["category_certificate","income_certificate","admission_letter","fee_receipt","bank_details"], other=["Admission in a notified top-class institution","Covers fees and allowances as per scheme norms"],
    url="https://scholarships.gov.in", sources=["https://www.buddy4study.com/article/national-scholarship"], note="Check NSP for any extension.", reopens=6)
add(slug="santoor-womens", name="Santoor Women's Scholarship", provider="Wipro Consumer Care (Santoor)", ptype="private",
    min=30000,max=30000,period="one_time",deadline="2026-10-15",
    criteria=[F(),c("state","in",["AP","MH"]),LV(["ug"]),c("year_of_study","=",1)],
    docs=["marksheet","admission_letter","bank_details","id_proof"], other=["Completed Class 10 and 12 from government schools or colleges"],
    url="https://www.buddy4study.com/online-application-form", sources=["https://morungexpress.com/scholarship-roundup-orober-14-2026-s"], reopens=9)
add(slug="sml-unnati", name="SML Unnati Scholarship", provider="SML Mahindra", ptype="private",
    min=30000,max=30000,period="one_time",deadline="2026-10-21",
    criteria=[F(),LV(["ug","diploma"]),c("stream","in",["engineering","science"])],
    docs=["marksheet","income_certificate","bank_details","id_proof"], other=["Daughters of commercial vehicle drivers","STEM or core engineering programmes"],
    url="https://www.buddy4study.com/article/sml-mahindra-scholarship", sources=["https://www.buddy4study.com/article/sml-mahindra-scholarship"], reopens=9)
add(slug="aditya-birla-capital", name="Aditya Birla Capital Scholarship Program", provider="Aditya Birla Capital Foundation", ptype="private",
    min=24000,max=60000,period="one_time",deadline="2026-10-30",
    criteria=[F(),MK(60),INC(600000),LV(["school_11_12","diploma","ug","pg"])],
    docs=["marksheet","income_certificate","fee_receipt","bank_details","id_proof"], other=["Must study at a government school, college or institution"],
    url="https://www.buddy4study.com/online-application-form", sources=["https://www.agrijob.in/?p=12058","https://internshala.com/competitions/?p=12875"], reopens=9)
add(slug="gates-cambridge", name="Gates Cambridge Scholarship", provider="Gates Cambridge Trust", ptype="international",
    scope="international", dest=["UK"], min=None,max=None,currency="GBP",coverage="full",deadline="2026-12-08",
    criteria=[LV(["ug","pg"])],
    docs=["marksheet","recommendation_letter","sop","resume","id_proof"], other=["Full-time postgraduate degree at the University of Cambridge","Some courses use a 6 January 2027 funding deadline instead","Apply through the Cambridge course application and tick the Gates funding option"],
    url="https://www.gatescambridge.org", sources=["https://www.scholarshipsads.com/gates-cambridge-scholarships/","https://www.scholars4dev.com/2026/08/24/gates-scholarships-for-international-students-at-university-of-cambridge/"], reopens=9)
add(slug="erasmus-mundus", name="Erasmus Mundus Joint Masters Scholarship", provider="European Commission (EACEA)", ptype="international",
    scope="international", dest=["EU"], min=1400,max=1400,currency="EUR",period="month",coverage="full",deadline=None,deadline_type="unknown",
    criteria=[LV(["ug","pg"])],
    docs=["marksheet","sop","recommendation_letter","resume","test_score","id_proof"], other=["Each programme sets its own deadline; most fall between December 2026 and January 2027","Apply to up to three programmes per year","Must hold a bachelor's degree by the programme's cut-off"],
    url="https://www.eacea.ec.europa.eu", sources=["https://opportunityinside.com/scholarships/erasmus-mundus-joint-masters-eu-2027.html","https://euroculture.wsmip.uj.edu.pl/admissions"])
add(slug="jn-tata-endowment", name="JN Tata Endowment Loan Scholarship", provider="JN Tata Endowment", ptype="international",
    scope="international", dest=["US","UK","EU","AU","CA"], min=None,max=2000000,period="total",coverage="partial",deadline=None,deadline_type="unknown",
    criteria=[c("nationality","in",["IN"]),LV(["ug","pg","phd"])],
    docs=["marksheet","sop","recommendation_letter","resume","id_proof"], other=["Loan scholarship (partly repayable) for postgraduate or doctoral study abroad","Applications usually open in early January and close in March","Online aptitude test and interview"],
    url="https://www.jntataendowment.org", sources=["https://leapscholar.com/blog/jn-tata-endowment-scholarship/"], note="2027-28 cycle expected to open January 2027.", reopens=1)
add(slug="inlaks-shivdasani", name="Inlaks Shivdasani Scholarship", provider="Inlaks Shivdasani Foundation", ptype="international",
    scope="international", dest=["US","UK","EU"], min=None,max=100000,currency="USD",period="total",coverage="partial",deadline=None,deadline_type="unknown",
    criteria=[c("nationality","in",["IN"]),LV(["ug","pg"])],
    docs=["marksheet","admission_letter","recommendation_letter","sop","id_proof"], other=["Under 30 years of age","Must already hold an admission offer from a top US, UK or European institution","Some subjects (e.g. business, computer science) are excluded"],
    url="https://www.inlaksfoundation.org", sources=["https://www.indiascholarships.in/kn/scholarships/inlaks-shivdasani-foundation-scholarship"], note="2027 cycle usually opens January–February and closes around 31 March.", reopens=1)
add(slug="chevening", name="Chevening Scholarship", provider="UK Government (FCDO)", ptype="international",
    scope="international", dest=["UK"], min=None,max=None,currency="GBP",coverage="full",deadline="2026-10-06",
    criteria=[c("nationality","in",["IN"]),c("work_experience_years",">=",2)],
    docs=["marksheet","recommendation_letter","sop","id_proof"], other=["One-year master's in the UK","Return to your home country for two years after the award"],
    url="https://www.chevening.org/scholarships/application-timeline/", sources=["https://www.chevening.org/scholarships/application-timeline/","https://www.businesstoday.in/nri/story/chevening-scholarship-opens-for-2027-28-who-can-apply-what-it-covers-key-deadline-for-indians-555345-2026-09-14"],
    verification="official", reopens=8)
add(slug="fulbright-nehru-masters", name="Fulbright-Nehru Master's Fellowships", provider="USIEF", ptype="international",
    scope="international", dest=["US"], min=None,max=None,currency="USD",coverage="full",deadline="2026-07-01",
    criteria=[c("nationality","in",["IN"]),c("work_experience_years",">=",3),MK(55)],
    docs=["marksheet","recommendation_letter","sop","resume","test_score","id_proof"], other=["Master's in eligible fields at a US university","Commitment to return to India"],
    url="https://www.usief.org.in", sources=["https://www.buddy4study.com/scholarship/fulbright-nehru-masters-fellowships"], reopens=2)

for s in S:
    s["last_verified"]=V
json.dump(S, open("/home/claude/grantly/data/scholarships.json","w"), ensure_ascii=False, indent=1)
print(len(S), sum(1 for s in S if s.get("deadline") and s["deadline"]>=V), "open with dated deadline")
