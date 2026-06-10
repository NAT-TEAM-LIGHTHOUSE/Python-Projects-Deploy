import { SampleDataset } from "@/types/csv";

export const sampleDatasets: SampleDataset[] = [
  {
    id: "sales",
    name: "Sales Data",
    description: "Quarterly sales records with revenue and regions",
    data: {
      headers: ["Product", "Region", "Quarter", "Revenue", "Units Sold", "Growth"],
      rows: [
        ["Laptop", "North", "Q1", "45000", "150", "12%"],
        ["Laptop", "South", "Q1", "38000", "120", "8%"],
        ["Laptop", "East", "Q1", "52000", "175", "15%"],
        ["Laptop", "West", "Q1", "41000", "135", "10%"],
        ["Desktop", "North", "Q1", "28000", "70", "5%"],
        ["Desktop", "South", "Q1", "32000", "85", "9%"],
        ["Desktop", "East", "Q1", "25000", "65", "3%"],
        ["Desktop", "West", "Q1", "29000", "75", "7%"],
        ["Tablet", "North", "Q1", "18000", "200", "18%"],
        ["Tablet", "South", "Q1", "22000", "245", "22%"],
        ["Tablet", "East", "Q1", "19500", "215", "16%"],
        ["Tablet", "West", "Q1", "21000", "230", "20%"],
        ["Laptop", "North", "Q2", "48000", "160", "7%"],
        ["Laptop", "South", "Q2", "42000", "140", "11%"],
        ["Laptop", "East", "Q2", "55000", "185", "6%"],
        ["Laptop", "West", "Q2", "45000", "150", "10%"],
        ["Desktop", "North", "Q2", "30000", "75", "7%"],
        ["Desktop", "South", "Q2", "35000", "90", "9%"],
        ["Desktop", "East", "Q2", "27000", "70", "8%"],
        ["Desktop", "West", "Q2", "31000", "80", "7%"],
        ["Tablet", "North", "Q2", "20000", "225", "11%"],
        ["Tablet", "South", "Q2", "24000", "265", "9%"],
        ["Tablet", "East", "Q2", "21500", "240", "10%"],
        ["Tablet", "West", "Q2", "23000", "255", "10%"]
      ],
      rawContent: `Product,Region,Quarter,Revenue,Units Sold,Growth
Laptop,North,Q1,45000,150,12%
Laptop,South,Q1,38000,120,8%
Laptop,East,Q1,52000,175,15%
Laptop,West,Q1,41000,135,10%
Desktop,North,Q1,28000,70,5%
Desktop,South,Q1,32000,85,9%
Desktop,East,Q1,25000,65,3%
Desktop,West,Q1,29000,75,7%
Tablet,North,Q1,18000,200,18%
Tablet,South,Q1,22000,245,22%
Tablet,East,Q1,19500,215,16%
Tablet,West,Q1,21000,230,20%
Laptop,North,Q2,48000,160,7%
Laptop,South,Q2,42000,140,11%
Laptop,East,Q2,55000,185,6%
Laptop,West,Q2,45000,150,10%
Desktop,North,Q2,30000,75,7%
Desktop,South,Q2,35000,90,9%
Desktop,East,Q2,27000,70,8%
Desktop,West,Q2,31000,80,7%
Tablet,North,Q2,20000,225,11%
Tablet,South,Q2,24000,265,9%
Tablet,East,Q2,21500,240,10%
Tablet,West,Q2,23000,255,10%`
    }
  },
  {
    id: "employees",
    name: "Employee Directory",
    description: "Company employees with department and salary info",
    data: {
      headers: ["ID", "Name", "Department", "Position", "Salary", "Experience", "Location"],
      rows: [
        ["E001", "John Smith", "Engineering", "Senior Developer", "95000", "7 years", "New York"],
        ["E002", "Sarah Johnson", "Marketing", "Marketing Manager", "85000", "5 years", "Los Angeles"],
        ["E003", "Michael Chen", "Engineering", "Tech Lead", "120000", "10 years", "San Francisco"],
        ["E004", "Emily Davis", "HR", "HR Director", "90000", "8 years", "Chicago"],
        ["E005", "David Wilson", "Sales", "Sales Director", "110000", "12 years", "Boston"],
        ["E006", "Lisa Brown", "Finance", "Financial Analyst", "75000", "4 years", "Seattle"],
        ["E007", "James Taylor", "Engineering", "Junior Developer", "65000", "2 years", "Austin"],
        ["E008", "Jennifer Lee", "Marketing", "Content Specialist", "60000", "3 years", "Denver"],
        ["E009", "Robert Garcia", "Sales", "Account Executive", "80000", "6 years", "Miami"],
        ["E010", "Amanda Martinez", "Operations", "Operations Manager", "88000", "7 years", "Phoenix"],
        ["E011", "Christopher Anderson", "Engineering", "DevOps Engineer", "92000", "5 years", "Portland"],
        ["E012", "Jessica Thompson", "Finance", "Accountant", "68000", "3 years", "Atlanta"],
        ["E013", "Daniel White", "HR", "Recruiter", "55000", "2 years", "Dallas"],
        ["E014", "Michelle Harris", "Marketing", "SEO Specialist", "62000", "4 years", "San Diego"],
        ["E015", "Kevin Clark", "Sales", "Sales Representative", "58000", "3 years", "Philadelphia"]
      ],
      rawContent: `ID,Name,Department,Position,Salary,Experience,Location
E001,John Smith,Engineering,Senior Developer,95000,7 years,New York
E002,Sarah Johnson,Marketing,Marketing Manager,85000,5 years,Los Angeles
E003,Michael Chen,Engineering,Tech Lead,120000,10 years,San Francisco
E004,Emily Davis,HR,HR Director,90000,8 years,Chicago
E005,David Wilson,Sales,Sales Director,110000,12 years,Boston
E006,Lisa Brown,Finance,Financial Analyst,75000,4 years,Seattle
E007,James Taylor,Engineering,Junior Developer,65000,2 years,Austin
E008,Jennifer Lee,Marketing,Content Specialist,60000,3 years,Denver
E009,Robert Garcia,Sales,Account Executive,80000,6 years,Miami
E010,Amanda Martinez,Operations,Operations Manager,88000,7 years,Phoenix
E011,Christopher Anderson,Engineering,DevOps Engineer,92000,5 years,Portland
E012,Jessica Thompson,Finance,Accountant,68000,3 years,Atlanta
E013,Daniel White,HR,Recruiter,55000,2 years,Dallas
E014,Michelle Harris,Marketing,SEO Specialist,62000,4 years,San Diego
E015,Kevin Clark,Sales,Sales Representative,58000,3 years,Philadelphia`
    }
  },
  {
    id: "inventory",
    name: "Inventory Stock",
    description: "Product inventory with quantities and reorder levels",
    data: {
      headers: ["SKU", "Product Name", "Category", "Quantity", "Reorder Level", "Unit Price", "Supplier"],
      rows: [
        ["SKU001", "Wireless Mouse", "Electronics", "245", "50", "29.99", "TechSupply Co"],
        ["SKU002", "USB Cable Type-C", "Electronics", "520", "100", "12.99", "TechSupply Co"],
        ["SKU003", "Mechanical Keyboard", "Electronics", "78", "30", "149.99", "KeyTech Inc"],
        ["SKU004", "Monitor Stand", "Furniture", "34", "20", "79.99", "OfficePro"],
        ["SKU005", "Desk Lamp LED", "Furniture", "156", "40", "45.99", "OfficePro"],
        ["SKU006", "Notebook Pack", "Office Supplies", "890", "200", "8.99", "StationeryPlus"],
        ["SKU007", "Ballpoint Pens", "Office Supplies", "1200", "300", "4.99", "StationeryPlus"],
        ["SKU008", "Sticky Notes", "Office Supplies", "560", "150", "3.99", "StationeryPlus"],
        ["SKU009", "Webcam HD", "Electronics", "67", "25", "89.99", "TechSupply Co"],
        ["SKU010", "Headphones", "Electronics", "123", "40", "129.99", "AudioTech"],
        ["SKU011", "Standing Desk", "Furniture", "18", "10", "599.99", "OfficePro"],
        ["SKU012", "Office Chair", "Furniture", "42", "15", "349.99", "OfficePro"],
        ["SKU013", "Paper Ream", "Office Supplies", "780", "250", "6.99", "StationeryPlus"],
        ["SKU014", "File Folders", "Office Supplies", "340", "100", "5.99", "StationeryPlus"],
        ["SKU015", "USB Hub", "Electronics", "189", "50", "34.99", "TechSupply Co"]
      ],
      rawContent: `SKU,Product Name,Category,Quantity,Reorder Level,Unit Price,Supplier
SKU001,Wireless Mouse,Electronics,245,50,29.99,TechSupply Co
SKU002,USB Cable Type-C,Electronics,520,100,12.99,TechSupply Co
SKU003,Mechanical Keyboard,Electronics,78,30,149.99,KeyTech Inc
SKU004,Monitor Stand,Furniture,34,20,79.99,OfficePro
SKU005,Desk Lamp LED,Furniture,156,40,45.99,OfficePro
SKU006,Notebook Pack,Office Supplies,890,200,8.99,StationeryPlus
SKU007,Ballpoint Pens,Office Supplies,1200,300,4.99,StationeryPlus
SKU008,Sticky Notes,Office Supplies,560,150,3.99,StationeryPlus
SKU009,Webcam HD,Electronics,67,25,89.99,TechSupply Co
SKU010,Headphones,Electronics,123,40,129.99,AudioTech
SKU011,Standing Desk,Furniture,18,10,599.99,OfficePro
SKU012,Office Chair,Furniture,42,15,349.99,OfficePro
SKU013,Paper Ream,Office Supplies,780,250,6.99,StationeryPlus
SKU014,File Folders,Office Supplies,340,100,5.99,StationeryPlus
SKU015,USB Hub,Electronics,189,50,34.99,TechSupply Co`
    }
  },
  {
    id: "customers",
    name: "Customer Feedback",
    description: "Customer reviews with ratings and satisfaction scores",
    data: {
      headers: ["Customer ID", "Name", "Product", "Rating", "Comment", "Date", "Response Time"],
      rows: [
        ["CUST001", "Alex Thompson", "Wireless Mouse", "5", "Excellent quality, very responsive", "2024-01-15", "2 hours"],
        ["CUST002", "Maria Garcia", "Mechanical Keyboard", "4", "Great typing experience but pricey", "2024-01-16", "4 hours"],
        ["CUST003", "Ryan Mitchell", "USB Cable", "5", "Fast charging, durable cable", "2024-01-17", "1 hour"],
        ["CUST004", "Sophie Anderson", "Monitor Stand", "3", "Decent but wobbly at times", "2024-01-18", "6 hours"],
        ["CUST005", "Jake Williams", "Desk Lamp", "5", "Perfect brightness, love the design", "2024-01-19", "3 hours"],
        ["CUST006", "Olivia Brown", "Notebook Pack", "4", "Good quality paper, nice cover", "2024-01-20", "2 hours"],
        ["CUST007", "Ethan Davis", "Ballpoint Pens", "5", "Smooth writing, doesn't skip", "2024-01-21", "1 hour"],
        ["CUST008", "Ava Martinez", "Webcam HD", "4", "Good video quality for calls", "2024-01-22", "5 hours"],
        ["CUST009", "Liam Johnson", "Headphones", "5", "Amazing sound, comfortable", "2024-01-23", "2 hours"],
        ["CUST010", "Isabella Lee", "Standing Desk", "4", "Very sturdy, easy to adjust", "2024-01-24", "8 hours"],
        ["CUST011", "Noah Clark", "Office Chair", "5", "Super comfortable for long hours", "2024-01-25", "3 hours"],
        ["CUST012", "Mia Wilson", "USB Hub", "4", "Works well, good number of ports", "2024-01-26", "2 hours"],
        ["CUST013", "Lucas Taylor", "Sticky Notes", "5", "Perfect size, sticky enough", "2024-01-27", "1 hour"],
        ["CUST014", "Charlotte White", "Paper Ream", "4", "Good quality for printing", "2024-01-28", "4 hours"],
        ["CUST015", "Benjamin Harris", "File Folders", "3", "A bit flimsy but ok", "2024-01-29", "6 hours"]
      ],
      rawContent: `Customer ID,Name,Product,Rating,Comment,Date,Response Time
CUST001,Alex Thompson,Wireless Mouse,5,Excellent quality very responsive,2024-01-15,2 hours
CUST002,Maria Garcia,Mechanical Keyboard,4,Great typing experience but pricey,2024-01-16,4 hours
CUST003,Ryan Mitchell,USB Cable,5,Fast charging durable cable,2024-01-17,1 hour
CUST004,Sophie Anderson,Monitor Stand,3,Decent but wobbly at times,2024-01-18,6 hours
CUST005,Jake Williams,Desk Lamp,5,Perfect brightness love the design,2024-01-19,3 hours
CUST006,Olivia Brown,Notebook Pack,4,Good quality paper nice cover,2024-01-20,2 hours
CUST007,Ethan Davis,Ballpoint Pens,5,Smooth writing does not skip,2024-01-21,1 hour
CUST008,Ava Martinez,Webcam HD,4,Good video quality for calls,2024-01-22,5 hours
CUST009,Liam Johnson,Headphones,5,Amazing sound comfortable,2024-01-23,2 hours
CUST010,Isabella Lee,Standing Desk,4,Very sturdy easy to adjust,2024-01-24,8 hours
CUST011,Noah Clark,Office Chair,5,Super comfortable for long hours,2024-01-25,3 hours
CUST012,Mia Wilson,USB Hub,4,Works well good number of ports,2024-01-26,2 hours
CUST013,Lucas Taylor,Sticky Notes,5,Perfect size sticky enough,2024-01-27,1 hour
CUST014,Charlotte White,Paper Ream,4,Good quality for printing,2024-01-28,4 hours
CUST015,Benjamin Harris,File Folders,3,A bit flimsy but ok,2024-01-29,6 hours`
    }
  }
];
