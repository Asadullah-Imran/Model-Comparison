import os
import json

def parse_csv(filepath):
    if not os.path.exists(filepath):
        print(f"Warning: File not found {filepath}")
        return []
    
    rows = []
    with open(filepath, 'r') as f:
        lines = f.readlines()
        if not lines:
            return []
        
        # Parse headers
        headers = [h.strip() for h in lines[0].split(',')]
        
        # Parse data
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            values = line.split(',')
            row_dict = {}
            for i, header in enumerate(headers):
                if i < len(values):
                    val = values[i].strip()
                    try:
                        if '.' in val:
                            row_dict[header] = float(val)
                        elif val.isdigit():
                            row_dict[header] = int(val)
                        else:
                            row_dict[header] = float(val)
                    except ValueError:
                        row_dict[header] = val
            rows.append(row_dict)
    return rows

def read_link(filepath):
    if not os.path.exists(filepath):
        print(f"Warning: Link file not found {filepath}")
        return ""
    with open(filepath, 'r') as f:
        return f.read().strip()

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Models config
    models_config = [
        {
            "name": "Smart",
            "csv": os.path.join(base_dir, "Smart", "metrics_all_datasets.csv"),
            "link": os.path.join(base_dir, "Smart", "link.txt")
        },
        {
            "name": "CAGE",
            "csv": os.path.join(base_dir, "CAGE", "CAGE_all_results.csv"),
            "link": os.path.join(base_dir, "CAGE", "link.txt")
        },
        {
            "name": "Arise",
            "csv": os.path.join(base_dir, "Arise", "metrics_all_datasets.csv"),
            "link": os.path.join(base_dir, "Arise", "link.txt")
        },
        {
            "name": "Arise-Sill",
            "csv": os.path.join(base_dir, "Arise-Sill", "metrics_all_datasets.csv"),
            "link": os.path.join(base_dir, "Arise-Sill", "link.txt")
        },
        {
            "name": "SpatialGlue",
            "csv": os.path.join(base_dir, "SpatialGlue", "SpatialGlue_all_results.csv"),
            "link": os.path.join(base_dir, "SpatialGlue", "link.txt")
        }
    ]
    
    aggregated_data = []
    links = {}
    
    for cfg in models_config:
        model_name = cfg["name"]
        print(f"Processing model: {model_name}")
        
        # Read link
        links[model_name] = read_link(cfg["link"])
        
        # Parse CSV
        rows = parse_csv(cfg["csv"])
        for r in rows:
            r["model"] = model_name
            # Ensure proper type conversions
            if "seed" in r:
                r["seed"] = int(r["seed"])
            for metric in ["ARI", "NMI", "AMI", "Homogeneity", "V-measure", "Silhouette"]:
                if metric in r:
                    r[metric] = float(r[metric])
            aggregated_data.append(r)
            
    # Output to data.js
    output_path = os.path.join(base_dir, "data.js")
    with open(output_path, 'w') as f:
        f.write("// Auto-generated data file from build_data_js.py\n")
        f.write("window.fallbackData = ")
        f.write(json.dumps(aggregated_data, indent=2))
        f.write(";\n\n")
        f.write("window.fallbackLinks = ")
        f.write(json.dumps(links, indent=2))
        f.write(";\n")
        
    print(f"Successfully created {output_path} with {len(aggregated_data)} records.")

if __name__ == "__main__":
    main()
