import sys
import collections.abc
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Professional Modern Dark Theme Palette
    BG_DARK = RGBColor(15, 23, 42)          # #0F172A (Deep Slate Navy)
    CARD_BG = RGBColor(30, 41, 59)          # #1E293B (Card Slate)
    CARD_BG_ALT = RGBColor(24, 33, 47)      # Slightly darker card for zebra
    ACCENT_YELLOW = RGBColor(253, 184, 19)  # #FDB813 (Rapido Yellow / Highlight)
    ACCENT_GREEN = RGBColor(16, 185, 129)   # #10B981 (Emerald Green / Success)
    ACCENT_CYAN = RGBColor(56, 189, 248)    # #38BDF8 (Sky Blue)
    TEXT_MAIN = RGBColor(248, 250, 252)     # #F8FAFC (Crisp White)
    TEXT_MUTED = RGBColor(148, 163, 184)    # #94A3B8 (Light Grey Text)
    BORDER_COLOR = RGBColor(51, 65, 85)     # #334155 (Subtle Card Border)

    blank_layout = prs.slide_layouts[6]

    def apply_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_DARK
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, category_text="TRIPZY • PROJECT REVIEW 3"):
        # Category Tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.35))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        tf_cat.margin_left = tf_cat.margin_top = tf_cat.margin_right = tf_cat.margin_bottom = 0
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = ACCENT_YELLOW

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.7), Inches(0.7))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_MAIN

    def add_card(slide, left, top, width, height, title="", border_accent=False, fill_color=CARD_BG):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = fill_color
        card.line.color.rgb = ACCENT_YELLOW if border_accent else BORDER_COLOR
        card.line.width = Pt(1.5 if border_accent else 1.0)
        
        if title:
            tb = slide.shapes.add_textbox(left + Inches(0.2), top + Inches(0.15), width - Inches(0.4), Inches(0.45))
            tf = tb.text_frame
            tf.word_wrap = True
            tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
            p = tf.paragraphs[0]
            p.text = title
            p.font.size = Pt(14)
            p.font.bold = True
            p.font.color.rgb = ACCENT_YELLOW if border_accent else TEXT_MAIN
        return card

    # =========================================================================
    # SLIDE 1: Project Title & Team
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    apply_background(s1)

    pill = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.1), Inches(3.4), Inches(0.45))
    pill.fill.solid()
    pill.fill.fore_color.rgb = ACCENT_YELLOW
    pill.line.fill.background()
    p = pill.text_frame.paragraphs[0]
    p.text = "PROJECT REVIEW 3 • EVALUATION"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = BG_DARK
    p.alignment = PP_ALIGN.CENTER

    tb1 = s1.shapes.add_textbox(Inches(0.8), Inches(1.75), Inches(11.7), Inches(1.8))
    tf1 = tb1.text_frame
    tf1.word_wrap = True
    p1 = tf1.paragraphs[0]
    p1.text = "Tripzy: Next-Gen Urban Ride-Sharing Platform"
    p1.font.size = Pt(34)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_MAIN

    p1_sub = tf1.add_paragraph()
    p1_sub.text = "Multi-Tier Micro-Mobility Dispatch (Bike Taxi & Auto), Fair Pricing & Security PIN Verification"
    p1_sub.font.size = Pt(17)
    p1_sub.font.color.rgb = ACCENT_YELLOW
    p1_sub.space_before = Pt(8)

    add_card(s1, Inches(0.8), Inches(3.9), Inches(5.7), Inches(2.8), "Project Credentials")
    tb_c1 = s1.shapes.add_textbox(Inches(1.05), Inches(4.5), Inches(5.2), Inches(2.0))
    tf_c1 = tb_c1.text_frame
    tf_c1.word_wrap = True
    c1_bullets = [
        "Course: Final Year Capstone Project Review 3",
        "Domain: Full-Stack Web Development, Real-Time Systems & GIS",
        "Core Philosophy: Transparent low-cost mobility tailored for Indian cities",
        "Key Differentiator: Open-source Leaflet map (Zero paid Google API fees)"
    ]
    for b in c1_bullets:
        p = tf_c1.add_paragraph() if tf_c1.paragraphs[0].text else tf_c1.paragraphs[0]
        p.text = "• " + b
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED
        p.space_after = Pt(6)

    add_card(s1, Inches(6.8), Inches(3.9), Inches(5.7), Inches(2.8), "Team & Live Deployments", True)
    tb_c2 = s1.shapes.add_textbox(Inches(7.05), Inches(4.5), Inches(5.2), Inches(2.0))
    tf_c2 = tb_c2.text_frame
    tf_c2.word_wrap = True
    c2_bullets = [
        "Group Number: Group 12",
        "Team Members: Student Capstone Team",
        "Live Web Frontend: Deployed on Vercel Cloud",
        "Live Backend API: Node.js & WebSockets on Render",
        "Cloud Database: MongoDB Atlas Distributed Cluster"
    ]
    for b in c2_bullets:
        p = tf_c2.add_paragraph() if tf_c2.paragraphs[0].text else tf_c2.paragraphs[0]
        p.text = "• " + b
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MAIN
        p.space_after = Pt(6)

    # =========================================================================
    # SLIDE 2: What is Tripzy? (Project Introduction)
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    apply_background(s2)
    add_header(s2, "What is Tripzy & Why Did We Build It?", "PROJECT INTRODUCTION")

    add_card(s2, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.2), "What is Tripzy?", True)
    tb2_l = s2.shapes.add_textbox(Inches(1.05), Inches(2.2), Inches(5.2), Inches(4.3))
    tf2_l = tb2_l.text_frame
    tf2_l.word_wrap = True
    what_is = [
        "A Modern Web Ride-Hailing Platform: Designed specifically for Indian urban travel, prioritizing low-cost Bike Taxis and Autos alongside Sedans and SUVs.",
        "Live Real-Time Map & Tracking: Passengers can enter pickup and drop locations, see vehicle fares instantly, and track their driver live on a smooth interactive map.",
        "100% Free Open Mapping Engine: Powered by Leaflet and OpenStreetMap, eliminating expensive Google Maps billing that breaks student and startup projects.",
        "Simple & Clean User Experience: Instant booking, dual consoles for Passenger and Captain (Driver), and in-app Razorpay sandbox payments."
    ]
    for w in what_is:
        p = tf2_l.add_paragraph() if tf2_l.paragraphs[0].text else tf2_l.paragraphs[0]
        p.text = "✔ " + w
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MAIN
        p.space_after = Pt(10)

    add_card(s2, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.2), "Why Did We Build It? (Common Indian Cab Problems)")
    tb2_r = s2.shapes.add_textbox(Inches(7.05), Inches(2.2), Inches(5.2), Inches(4.3))
    tf2_r = tb2_r.text_frame
    tf2_r.word_wrap = True
    problems = [
        "Drivers Canceling Rides (25%–35%): In Uber and Ola, drivers don't know the destination beforehand. They call the rider, ask 'Where to go?', and cancel if they don't like it.",
        "Unfair Surprise Surge Prices: Platforms suddenly double or triple fares during rush hours or rain, making passengers feel cheated.",
        "Solo Cars Jamming City Roads: Excessive single-passenger cars cause massive traffic gridlocks instead of encouraging compact micro-mobility.",
        "Wrong-Car Boarding & Safety Risks: Passengers often accidentally get into the wrong vehicle, and drivers can start trips without physical verification."
    ]
    for pr in problems:
        p = tf2_r.add_paragraph() if tf2_r.paragraphs[0].text else tf2_r.paragraphs[0]
        p.text = "✖ " + pr
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED
        p.space_after = Pt(10)

    # =========================================================================
    # SLIDE 3: Technology Stack Used
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    apply_background(s3)
    add_header(s3, "Technology Stack Used in Tripzy", "SYSTEM TOOLS & ARCHITECTURE")

    tech_cards = [
        ("Frontend Client", [
            "React.js 18 (Component-driven single page app)",
            "Vite 5 (Ultra-fast bundler and hot reload)",
            "Leaflet.js (High-performance GIS map engine)",
            "OpenStreetMap (Free community street tiles)",
            "SCSS / SASS (Crisp dark-mode responsive styling)"
        ]),
        ("Backend Services", [
            "Node.js (High-speed asynchronous runtime)",
            "Express.js (RESTful APIs for rides & auth)",
            "Socket.IO (Duplex WebSockets for live telemetry)",
            "OSRM Engine (Real road routing and duration)",
            "Haversine Formula (Instant distance calculation)"
        ]),
        ("Database & Security", [
            "MongoDB Atlas (Cloud NoSQL database)",
            "Mongoose (Schema models and validations)",
            "JSON Web Tokens (JWT) (Secure 24h user login)",
            "BCrypt (Salted password hashing)",
            "4-Digit Security PIN (Mutual ride verification)"
        ]),
        ("Payments & Cloud", [
            "Razorpay Sandbox (UPI, Card & Cash simulation)",
            "Vercel (Instant edge global CDN for frontend)",
            "Render Cloud (Containerized backend web service)",
            "GitHub (Version control & CI/CD deployment)",
            "Strict 75km Geocoding (Intra-city search filter)"
        ])
    ]

    for idx, (title, items) in enumerate(tech_cards):
        c_left = Inches(0.8 + idx * 2.95)
        add_card(s3, c_left, Inches(1.6), Inches(2.8), Inches(5.2), title, True if idx == 0 else False)
        tb = s3.shapes.add_textbox(c_left + Inches(0.18), Inches(2.2), Inches(2.45), Inches(4.3))
        tf = tb.text_frame
        tf.word_wrap = True
        for it in items:
            p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
            p.text = "• " + it
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_MUTED
            p.space_after = Pt(8)

    # =========================================================================
    # SLIDE 4: How Tripzy Works (Step-by-Step User Flow)
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    apply_background(s4)
    add_header(s4, "How Tripzy Works: Step-by-Step User Flow", "OPERATIONAL WORKFLOW")

    add_card(s4, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.2), "Passenger Booking Journey", True)
    tb4_l = s4.shapes.add_textbox(Inches(1.05), Inches(2.2), Inches(5.2), Inches(4.3))
    tf4_l = tb4_l.text_frame
    tf4_l.word_wrap = True
    passenger_steps = [
        "1. Enter Pickup & Drop: High-contrast auto-suggest strictly filters intra-city locations (< 75 km) to avoid irrelevant destinations.",
        "2. Choose Vehicle Tier: Pick Moto (Bike), Auto, Sedan, or SUV with clear upfront price and real-time CO2 savings badge.",
        "3. Optional Preferences: Choose AC comfort or pre-lock a Guaranteed Return Ride at 0% surge.",
        "4. Receive 4-Digit Security PIN: Upon booking, the passenger receives a private 4-digit PIN required to start the ride.",
        "5. Live Map Tracking: Track driver approaching in real time via WebSockets and pay smoothly via Razorpay sandbox / Cash."
    ]
    for s in passenger_steps:
        p = tf4_l.add_paragraph() if tf4_l.paragraphs[0].text else tf4_l.paragraphs[0]
        p.text = s
        p.font.size = Pt(11.5)
        p.font.color.rgb = TEXT_MAIN
        p.space_after = Pt(8)

    add_card(s4, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.2), "Captain (Driver) Journey")
    tb4_r = s4.shapes.add_textbox(Inches(7.05), Inches(2.2), Inches(5.2), Inches(4.3))
    tf4_r = tb4_r.text_frame
    tf4_r.word_wrap = True
    driver_steps = [
        "1. Go Online in Captain Console: One-click toggle connects the driver to the Socket.IO live dispatch radar mesh.",
        "2. Transparent Ride Request: Incoming radar popup clearly shows pickup spot, drop-off destination, and estimated earnings.",
        "3. Accept Ride: Driver accepts within the radar countdown; passenger is notified immediately with driver details.",
        "4. Verify 4-Digit Start PIN: Driver arrives at pickup and must enter the passenger's PIN; the trip meter will NOT start without it.",
        "5. Complete & Collect Fare: Driver navigates to destination, completes the trip on screen, and collects digital or cash payment."
    ]
    for s in driver_steps:
        p = tf4_r.add_paragraph() if tf4_r.paragraphs[0].text else tf4_r.paragraphs[0]
        p.text = s
        p.font.size = Pt(11.5)
        p.font.color.rgb = TEXT_MUTED
        p.space_after = Pt(8)

    # =========================================================================
    # SLIDE 5: System Architecture & How Data Moves
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    apply_background(s5)
    add_header(s5, "System Architecture & How Data Moves", "TECHNICAL SYSTEM ARCHITECTURE")

    arch_layers = [
        ("Layer 1: User Interface & Map Display (Frontend)", 
         "React 18 Single Page App • Leaflet.js • OpenStreetMap • SCSS", 
         "Renders high-DPI interactive maps, animated driver pins, pickup/drop markers, and dual Passenger Hub and Captain Consoles. Completely free of Google API costs."),
        ("Layer 2: Real-Time Event & Dispatch Gateway", 
         "Socket.IO Duplex WebSockets • Event Broadcast Mesh", 
         "Delivers sub-100ms real-time communication: broadcasts ride radar alerts to nearby captains, updates live car positions on the map, and notifies riders upon acceptance."),
        ("Layer 3: REST API & Geospatial Routing Engines", 
         "Node.js • Express.js • OSRM Routing Engine • Haversine Formula", 
         "Calculates accurate road driving distance and travel duration, generates route polylines, processes /api/rides/estimate, and enforces < 75 km intra-city radius filters."),
        ("Layer 4: Database & Payment Settlement Sandbox", 
         "MongoDB Atlas Cloud NoSQL • Mongoose Models • Razorpay Sandbox Engine", 
         "Securely persists rider and driver profiles, trip state machine records, hashed passwords, 4-digit start PIN tokens, and simulates UPI, Card, and Cash checkouts.")
    ]

    for idx, (layer_title, tech_sub, layer_desc) in enumerate(arch_layers):
        c_top = Inches(1.55 + idx * 1.33)
        add_card(s5, Inches(0.8), c_top, Inches(11.7), Inches(1.22), border_accent=(idx == 1))
        tb = s5.shapes.add_textbox(Inches(1.05), c_top + Inches(0.08), Inches(11.2), Inches(1.08))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p0 = tf.paragraphs[0]
        p0.text = "🏛️ " + layer_title + "  |  "
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = ACCENT_YELLOW
        
        run0 = p0.add_run()
        run0.text = tech_sub
        run0.font.bold = False
        run0.font.size = Pt(11)
        run0.font.color.rgb = ACCENT_CYAN

        p1 = tf.add_paragraph()
        p1.text = "Functionality: " + layer_desc
        p1.font.size = Pt(10.5)
        p1.font.color.rgb = TEXT_MUTED

    # =========================================================================
    # SLIDE 6: Key Features of Our Platform
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    apply_background(s6)
    add_header(s6, "Key Features of the Tripzy Platform", "CORE SYSTEM CAPABILITIES")

    feature_cards = [
        ("🛵 4 Indian Urban Vehicle Tiers", [
            "Tripzy Moto (Bike Taxi): Fastest commute through dense city traffic; lowest fare.",
            "Tripzy Auto (3-Wheeler): Budget-friendly CNG city rides with zero meter haggling.",
            "Tripzy Go (Sedan): Comfortable 4-seater air-conditioned city commute.",
            "Tripzy Premier (SUV): Spacious ride for groups and airport luggage."
        ]),
        ("🗺️ 100% Free Open Mapping Engine", [
            "Powered by Leaflet.js with official OpenStreetMap tiles.",
            "No expensive Google Maps API key required; zero risk of sudden billing failure.",
            "Strict 75 km intra-city radius filter prevents out-of-city or foreign search clutter.",
            "Smooth animated pickup/drop markers and route polyline rendering."
        ]),
        ("💻 Dedicated Dual Consoles", [
            "Passenger Console: High-contrast address search, vehicle selection, and live tracking.",
            "Captain Console: Driver radar alerts, online/offline toggle, and earnings counter.",
            "Instant Role Switching: Test and demonstrate both rider and driver in real time.",
            "Sub-100ms Duplex Telemetry: Real-time location updates via Socket.IO."
        ]),
        ("💳 Razorpay Digital Sandbox Checkout", [
            "Integrated payment gateway sandbox supporting UPI, Cards, NetBanking, and Cash.",
            "Transparent upfront fare calculation based on actual road distance and duration.",
            "Zero hidden charges, platform fees, or deceptive cancellation penalties.",
            "Automated payment receipt and state transition upon trip completion."
        ])
    ]

    for idx, (title, points) in enumerate(feature_cards):
        row = idx // 2
        col = idx % 2
        c_left = Inches(0.8 + col * 5.95)
        c_top = Inches(1.6 + row * 2.65)
        add_card(s6, c_left, c_top, Inches(5.8), Inches(2.45), title, True if idx == 0 else False)
        tb = s6.shapes.add_textbox(c_left + Inches(0.2), c_top + Inches(0.55), Inches(5.4), Inches(1.8))
        tf = tb.text_frame
        tf.word_wrap = True
        for pt in points:
            p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
            p.text = "• " + pt
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_MUTED
            p.space_after = Pt(4)

    # =========================================================================
    # SLIDE 7: Review 2 Suggestions & Actions Taken (Table)
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    apply_background(s7)
    add_header(s7, "Review 2 Suggestions & Actions Taken", "REVIEW 2 PROGRESS EVALUATION")

    table_shape = s7.shapes.add_table(5, 4, Inches(0.8), Inches(1.6), Inches(11.7), Inches(5.2))
    table = table_shape.table
    table.columns[0].width = Inches(0.7)
    table.columns[1].width = Inches(3.6)
    table.columns[2].width = Inches(4.6)
    table.columns[3].width = Inches(2.8)

    headers = ["#", "Review 2 Suggestion / Feedback", "Action Taken by Our Team", "Verification & Status"]
    for col_idx, h in enumerate(headers):
        cell = table.cell(0, col_idx)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = CARD_BG
        p = cell.text_frame.paragraphs[0]
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = ACCENT_YELLOW

    row_data = [
        ("1", 
         "Read research papers and find structural gaps in existing ride-booking systems.", 
         "Surveyed 4 peer-reviewed research papers (AER, Management Science, PNAS, TR-C). Identified destination blindness, surge mistrust, and traffic gridlocks.", 
         "Literature review completed; 4 specific gaps identified and documented."),
        ("2", 
         "Implement concrete solutions for the identified gaps in the codebase.", 
         "Built dedicated /api/rides/estimate, upfront drop location display, mutual 4-digit start PIN verification, and driver heading corridors.", 
         "Implemented in backend routes and active on frontend."),
        ("3", 
         "Add new features to make Tripzy different from Uber, Ola, and Rapido.", 
         "Created Guaranteed Return Ride (0% surge pre-booking), Upfront AC Choice, Live Grams CO2 Saved badge, and 1-tap 112 Safety Shield.", 
         "Fully designed, integrated, and surfaced on UI."),
        ("4", 
         "Perform comprehensive testing of ride booking, acceptance, and operations.", 
         "Built automated 12-step E2E simulation script testing concurrent passenger booking, driver radar alerts, OTP validation, and completion.", 
         "100% test pass rate across all 12 operational stages.")
    ]

    for row_idx, r in enumerate(row_data):
        for col_idx, val in enumerate(r):
            cell = table.cell(row_idx + 1, col_idx)
            cell.text = val
            cell.fill.solid()
            cell.fill.fore_color.rgb = CARD_BG_ALT if row_idx % 2 == 0 else CARD_BG
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(11)
            if col_idx == 0:
                p.font.bold = True
                p.font.color.rgb = ACCENT_YELLOW
            elif col_idx == 3:
                p.font.color.rgb = ACCENT_GREEN
            else:
                p.font.color.rgb = TEXT_MAIN

    # =========================================================================
    # SLIDE 8: Research Papers: What We Learnt
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    apply_background(s8)
    add_header(s8, "Research Papers: What We Learnt (Literature Survey)", "LITERATURE SURVEY & REAL-WORLD GAPS")

    papers_learnt = [
        (
            "1. Chen, Sheldon, & Kawano — American Economic Review",
            "Core Problem Learnt: 'Destination Blindness' Causes 25%–35% Ride Cancellations",
            "When platforms hide the passenger's destination to force drivers to take all rides, it severely backfires. Drivers accept the ride, immediately call the customer asking 'Where are you going?', and cancel if the trip is unprofitable or away from their home."
        ),
        (
            "2. Cachon, Daniels, & Lobel — Management Science",
            "Core Problem Learnt: Opaque Surge Pricing Destroys Consumer Trust & Causes Driver Instability",
            "Surprise 2x–3x surge pricing algorithms make customers feel cheated and angry during emergencies or bad weather. At the same time, sudden wage fluctuations create severe dissatisfaction and mistrust for drivers."
        ),
        (
            "3. Fielbaum, Kucharski, & Cats — Transportation Research Part C",
            "Core Problem Learnt: Solo-Passenger Private Cars Increase Urban Congestion by 18%",
            "Direct point-to-point car rides choke urban downtown corridors. To make cities livable, ride apps must encourage high-density micro-mobility (bikes and autos) and serve as first-mile/last-mile feeders to public transit."
        ),
        (
            "4. Bertsimas, Jaillet, & Martin — Operations Research",
            "Core Problem Learnt: Greedy 'Nearest-Car' Dispatch Wastes Fuel & Creates Deadhead Mileage",
            "Naive algorithms dispatch any driver who is closest on the map, often forcing empty cars to make long cross-town trips for short pickups, causing wasted fuel, extra emissions, and long passenger wait times."
        )
    ]

    for idx, (p_title, p_headline, p_detail) in enumerate(papers_learnt):
        c_top = Inches(1.55 + idx * 1.33)
        add_card(s8, Inches(0.8), c_top, Inches(11.7), Inches(1.22), fill_color=CARD_BG_ALT if idx % 2 == 1 else CARD_BG)
        tb = s8.shapes.add_textbox(Inches(1.05), c_top + Inches(0.08), Inches(11.2), Inches(1.08))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p0 = tf.paragraphs[0]
        p0.text = "📖 " + p_title
        p0.font.size = Pt(12)
        p0.font.bold = True
        p0.font.color.rgb = ACCENT_YELLOW

        p1 = tf.add_paragraph()
        p1.text = "Problem Identified: " + p_headline
        p1.font.size = Pt(11)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_MAIN

        p2 = tf.add_paragraph()
        p2.text = p_detail
        p2.font.size = Pt(10)
        p2.font.color.rgb = TEXT_MUTED

    # =========================================================================
    # SLIDE 9: What We Built
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    apply_background(s9)
    add_header(s9, "What We Built: Code Solutions for the Research Gaps", "IMPLEMENTATION OF RESEARCH SOLUTIONS")

    what_built = [
        (
            "1. Upfront Destination Transparency + Heading Corridors (Solves Paper 1)",
            "Incoming radar alerts display the exact drop-off area upfront so drivers never have to call and cancel. Furthermore, drivers can set 'Heading Corridors' toward their home at shift end, receiving only rides along their way."
        ),
        (
            "2. Transparent Pricing Formula + Guaranteed Return Ride (Solves Paper 2)",
            "Implemented an unbundled fare engine with fixed base fare, per-km rate, and per-minute charge. Built 'Guaranteed Return Ride' pre-locking, ensuring return rides from distant spots at a locked 0% surge guarantee."
        ),
        (
            "3. Micro-Mobility Tiers + Live Grams CO2 Saved Counter (Solves Paper 3)",
            "Gave equal priority to Tripzy Moto (Bike Taxi) and CNG Auto alongside cars. Integrated dynamic carbon mathematics showing exact grams of CO2 saved on every ride, motivating riders to choose green options."
        ),
        (
            "4. Directional Radar Proximity Matching via Socket.IO (Solves Paper 4)",
            "Engineered an intelligent dispatch algorithm that filters candidates by heading direction and strict local radius (< 75 km), drastically minimizing empty deadhead driving for drivers."
        )
    ]

    for idx, (title, desc) in enumerate(what_built):
        c_top = Inches(1.55 + idx * 1.33)
        add_card(s9, Inches(0.8), c_top, Inches(11.7), Inches(1.22), border_accent=(idx == 0))
        tb = s9.shapes.add_textbox(Inches(1.05), c_top + Inches(0.08), Inches(11.2), Inches(1.08))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p0 = tf.paragraphs[0]
        p0.text = "🚀 " + title
        p0.font.size = Pt(12.5)
        p0.font.bold = True
        p0.font.color.rgb = ACCENT_GREEN

        p1 = tf.add_paragraph()
        p1.text = "Tripzy Implementation: " + desc
        p1.font.size = Pt(11)
        p1.font.color.rgb = TEXT_MAIN
        p1.space_before = Pt(3)

    # =========================================================================
    # SLIDE 10: New Unique Features (Part 1)
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    apply_background(s10)
    add_header(s10, "New Unique Features: What Makes Tripzy Stand Out (Part 1)", "INNOVATIONS & DIFFERENTIATORS")

    unique_part1 = [
        (
            "🔐 4-Digit Security Start PIN",
            "Server generates a secure, unique 4-digit PIN code visible exclusively on the passenger's screen upon booking.",
            [
                "The driver cannot start the trip meter or navigation without entering this exact 4-digit code on their console.",
                "Completely eliminates wrong-car boarding accidents, confusion at crowded venues, and unauthorized fake ride starts.",
                "Creates a safe, mutual digital handshake between passenger and captain before any wheels move."
            ]
        ),
        (
            "🔄 Guaranteed Return Ride (Surge Shield)",
            "A specialized feature designed for commuters traveling to airports, remote IT parks, or late-night social gatherings.",
            [
                "Riders can pre-book and lock their return trip with an incoming backhaul driver when booking their outbound ride.",
                "Includes a 0% Surge Guarantee, protecting the passenger from getting stranded late at night or paying 3x surge.",
                "Guarantees the driver a profitable return fare instead of driving back empty (eliminating deadheading)."
            ]
        ),
        (
            "❄️ Upfront AC Comfort Agreement",
            "Passengers can select AC On or AC Off preferences directly on the booking screen before confirming the ride.",
            [
                "Sets crystal-clear expectations and agreement before the vehicle arrives.",
                "Completely ends one of the biggest daily passenger complaints in India: drivers refusing to turn on AC in hot weather.",
                "Transparent fare adjustment: AC surcharge is clearly displayed and paid directly to the driver with zero hidden fees."
            ]
        )
    ]

    for idx, (title, subtitle, bullets) in enumerate(unique_part1):
        c_top = Inches(1.55 + idx * 1.8)
        add_card(s10, Inches(0.8), c_top, Inches(11.7), Inches(1.68), title, border_accent=(idx == 0))
        tb = s10.shapes.add_textbox(Inches(1.05), c_top + Inches(0.48), Inches(11.2), Inches(1.15))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p_sub = tf.paragraphs[0]
        p_sub.text = subtitle
        p_sub.font.size = Pt(11)
        p_sub.font.bold = True
        p_sub.font.color.rgb = ACCENT_YELLOW if idx == 0 else TEXT_MAIN
        p_sub.space_after = Pt(3)

        for b in bullets:
            p = tf.add_paragraph()
            p.text = "• " + b
            p.font.size = Pt(10.5)
            p.font.color.rgb = TEXT_MUTED

    # =========================================================================
    # SLIDE 11: New Unique Features (Part 2)
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    apply_background(s11)
    add_header(s11, "New Unique Features: What Makes Tripzy Stand Out (Part 2)", "INNOVATIONS & DIFFERENTIATORS")

    unique_part2 = [
        (
            "🛡️ In-App 112 Safety Shield",
            "A dedicated one-tap emergency safety center integrated directly into the live ride interface.",
            [
                "Instant direct dialing to 112 (National Police Emergency Helpline) with a single tap.",
                "Displays emergency contact numbers and vehicle license plate immediately.",
                "Continuous live GPS satellite telemetry coordinates visible without reloading or leaving the map view."
            ]
        ),
        (
            "📍 Strict 75 km Intra-City Search Filter",
            "Smart spatial geocoding boundary enforced across both frontend suggestions and backend verification.",
            [
                "Restricts search suggestions to places within a 75 km radius of the passenger's current metropolitan location.",
                "Completely eliminates frustrating out-of-city and international clutter (e.g. searching 'Paris' in Delhi no longer shows Paris, France 7,800 km away).",
                "High-contrast, readable white dropdown styling with fast Enter-key auto-selection."
            ]
        ),
        (
            "🌱 Real-Time Grams CO2 Saved Badge",
            "An integrated dynamic carbon offset calculation engine displayed on every vehicle selection card.",
            [
                "Calculates exact emissions displaced compared to a single-passenger private car (e.g. Bike Taxi saves ~150g CO2/km).",
                "Visually empowers riders with an emerald badge showing their positive environmental contribution in real time.",
                "Encourages sustainable micro-mobility choices across congested Indian urban corridors."
            ]
        )
    ]

    for idx, (title, subtitle, bullets) in enumerate(unique_part2):
        c_top = Inches(1.55 + idx * 1.8)
        add_card(s11, Inches(0.8), c_top, Inches(11.7), Inches(1.68), title, border_accent=(idx == 0))
        tb = s11.shapes.add_textbox(Inches(1.05), c_top + Inches(0.48), Inches(11.2), Inches(1.15))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p_sub = tf.paragraphs[0]
        p_sub.text = subtitle
        p_sub.font.size = Pt(11)
        p_sub.font.bold = True
        p_sub.font.color.rgb = ACCENT_YELLOW if idx == 0 else TEXT_MAIN
        p_sub.space_after = Pt(3)

        for b in bullets:
            p = tf.add_paragraph()
            p.text = "• " + b
            p.font.size = Pt(10.5)
            p.font.color.rgb = TEXT_MUTED

    # Save Presentation
    output_path = r"c:\Users\SURYA\Desktop\projects\Ride Sharing\Tripzy_Project_Review_3.pptx"
    prs.save(output_path)
    print(f"Presentation successfully created with 11 slides at: {output_path}")

if __name__ == "__main__":
    create_presentation()
